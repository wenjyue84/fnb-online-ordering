"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useTranslations } from "next-intl";
import { X, Send, MessageCircle, Mic } from "lucide-react";
import { useTray } from "@/lib/tray-context";
import { ChatBubble } from "./chat-bubble";
import { QuickReplies } from "./quick-replies";
import { cn } from "@/lib/utils";

const NUDGE_DELAY_MS = 3 * 60 * 1000; // 3 minutes
const SESSION_KEY = "mm_chat_session_id";
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ChatPanelProps {
  onClose: () => void;
}

type MenuItemLookup = Array<{ id: string; code: string; name: string; price: number }>;

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;

// Check Web Speech API support once (browser-only)
const speechSupported =
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

// US-410: Session persistence
function getOrCreateSession(): string {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw) as { sessionId: string; createdAt: number };
      if (Date.now() - data.createdAt < SESSION_EXPIRY_MS) {
        return data.sessionId;
      }
    }
  } catch { /* ignore */ }

  const sessionId = `web_${crypto.randomUUID().slice(0, 8)}_${Date.now()}`;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId, createdAt: Date.now() }));
  } catch { /* ignore */ }
  return sessionId;
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function isReturningUser(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as { createdAt: number };
    return Date.now() - data.createdAt < SESSION_EXPIRY_MS;
  } catch { return false; }
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const t = useTranslations("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const { addItem } = useTray();
  const handledToolCalls = useRef(new Set<string>());
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const nudgeSentRef = useRef(false);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

  // US-406: Menu items for card rendering
  const [menuItemsLookup, setMenuItemsLookup] = useState<MenuItemLookup>([]);
  // US-407: Track which messages have received feedback
  const [ratedMessages, setRatedMessages] = useState<Set<number>>(new Set());
  // US-410: Session ID
  const sessionIdRef = useRef<string>("");

  // Initialize session on mount
  useEffect(() => {
    sessionIdRef.current = getOrCreateSession();
  }, []);

  // US-406: Fetch menu items once for card rendering
  useEffect(() => {
    fetch("/api/menu")
      .then((r) => r.json())
      .then((data: MenuItemLookup) => setMenuItemsLookup(data))
      .catch(() => { /* silent fail */ });
  }, []);

  // US-410: Determine welcome message
  const returning = useRef(false);
  useEffect(() => {
    returning.current = isReturningUser();
  }, []);

  const welcomeText = t("welcome");
  const nudgeText = t("nudge");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    messages: [
      {
        id: "welcome",
        role: "assistant" as const,
        parts: [{ type: "text" as const, text: welcomeText }],
      },
    ],
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmitText = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;

      // US-410: Check for "new chat" / "start over" commands
      const lower = text.trim().toLowerCase();
      if (lower === "new chat" || lower === "start over") {
        clearSession();
        sessionIdRef.current = getOrCreateSession();
      }

      sendMessage({ text });
      setInput("");
    },
    [isLoading, sendMessage]
  );

  // US-407: Handle feedback submission
  const handleFeedback = useCallback((messageIndex: number, rating: "up" | "down") => {
    setRatedMessages((prev) => new Set(prev).add(messageIndex));
    fetch("/api/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messageIndex,
        rating,
        sessionId: sessionIdRef.current,
      }),
    }).catch(() => { /* silent fail */ });
  }, []);

  function toggleVoice() {
    if (!speechSupported) return;
    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Win = window as any;
      const SpeechRecognitionCtor =
        Win.SpeechRecognition || Win.webkitSpeechRecognition;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      // Track final transcript within this recognition session
      const session = { transcript: "" };

      recognition.onstart = () => setIsListening(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInput(text);
        session.transcript = text;
      };

      recognition.onend = () => {
        setIsListening(false);
        if (session.transcript.trim()) {
          sendMessage({ text: session.transcript });
          setInput("");
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        session.transcript = "";
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  }

  // Inactivity nudge: after NUDGE_DELAY_MS with no user message, send one gentle prompt
  const userMessageCount = messages.filter((m: { role: string }) => m.role === "user").length;
  useEffect(() => {
    if (nudgeSentRef.current) return;
    // Clear any pending timer when user sends a message
    if (nudgeTimerRef.current) {
      clearTimeout(nudgeTimerRef.current);
      nudgeTimerRef.current = null;
    }
    nudgeTimerRef.current = setTimeout(() => {
      if (!nudgeSentRef.current) {
        nudgeSentRef.current = true;
        setNudgeMessage(nudgeText);
      }
    }, NUDGE_DELAY_MS);
    return () => {
      if (nudgeTimerRef.current) {
        clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userMessageCount]);

  // Auto-scroll on new messages + process tool calls
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    // Process tool calls (AI SDK v6: tool calls are in msg.parts)
    messages.forEach((msg) => {
      if (msg.parts) {
        (msg.parts as Array<{ type: string; toolInvocation?: { toolName: string; state: string; toolCallId: string; args: { id: string; name: string; price: number } } }>).forEach((part) => {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "addToTray" &&
            (part.toolInvocation?.state === "call" ||
              part.toolInvocation?.state === "result") &&
            !handledToolCalls.current.has(part.toolInvocation?.toolCallId)
          ) {
            handledToolCalls.current.add(part.toolInvocation.toolCallId);
            const { id, name, price } = part.toolInvocation.args;
            addItem({ id, name, price });
          }
        });
      }
    });
  }, [messages, addItem]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSubmitText(input);
  }

  // Build message content array for quick-replies context detection
  const messageContents = messages.map((msg) => ({
    role: msg.role,
    content:
      (msg.parts as Array<{ type: string; text?: string }>)
        ?.filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("") ?? "",
  }));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
        <div>
          <h3 className="font-semibold text-primary-foreground">
            {t("title")}
          </h3>
          <p className="text-xs text-primary-foreground/70">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-1">
          {WHATSAPP_NUMBER && (
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1 text-primary-foreground/70 hover:text-primary-foreground"
              aria-label="Order via WhatsApp"
              title="Order via WhatsApp"
            >
              <MessageCircle className="h-5 w-5" />
            </a>
          )}
          <button
            onClick={onClose}
            className="rounded-md p-1 text-primary-foreground/70 hover:text-primary-foreground"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, index) => {
          const text =
            (msg.parts as Array<{ type: string; text?: string }>)
              ?.filter((p) => p.type === "text")
              .map((p) => p.text ?? "")
              .join("") ?? "";

          const hasPureToolCall =
            !text && (msg.parts as Array<{ type: string }>)?.some((p) => p.type === "tool-invocation");
          if (hasPureToolCall) return null;

          return (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={text}
              messageIndex={msg.role === "assistant" ? index : undefined}
              menuItems={menuItemsLookup}
              feedbackGiven={ratedMessages.has(index)}
              onFeedback={handleFeedback}
            />
          );
        })}
        {nudgeMessage && (
          <ChatBubble role="assistant" content={nudgeMessage} />
        )}
        {isLoading && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{t("error")}</p>}
      </div>

      {/* US-405: Quick reply buttons */}
      <QuickReplies
        messages={messageContents}
        onSend={handleSubmitText}
        isTyping={input.length > 0}
        isLoading={isLoading}
      />

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("placeholder")}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          disabled={isLoading}
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            disabled={isLoading}
            className={cn(
              "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50",
              isListening
                ? "bg-red-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            aria-label={isListening ? "Stop recording" : "Start voice input"}
          >
            {isListening && (
              <span className="absolute inset-0 animate-ping rounded-lg bg-red-400 opacity-60" />
            )}
            <Mic className="relative h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
