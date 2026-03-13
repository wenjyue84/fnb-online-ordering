"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { MenuItemCard } from "./menu-item-card";

interface ChatBubbleProps {
  role: string;
  content: string;
  messageIndex?: number;
  menuItems?: Array<{ id: string; code: string; name: string; price: number }>;
  feedbackGiven?: boolean;
  onFeedback?: (messageIndex: number, rating: "up" | "down") => void;
}

const ITEM_CODE_REGEX = /\b([A-Z]{2,4}\d{1,3})\b/g;

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {parseInline(line)}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

function extractItemCodes(text: string): string[] {
  const matches = text.match(ITEM_CODE_REGEX);
  if (!matches) return [];
  return [...new Set(matches)].slice(0, 3);
}

export function ChatBubble({
  role,
  content,
  messageIndex,
  menuItems,
  feedbackGiven,
  onFeedback,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const isAssistant = role === "assistant";
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showThanks, setShowThanks] = useState(false);

  const matchedItems = isAssistant && menuItems
    ? extractItemCodes(content)
        .map((code) => menuItems.find((m) => m.code === code))
        .filter(Boolean) as Array<{ id: string; code: string; name: string; price: number }>
    : [];

  const handleFeedback = useCallback(
    (r: "up" | "down") => {
      if (rating || feedbackGiven || messageIndex === undefined) return;
      setRating(r);
      setShowThanks(true);
      onFeedback?.(messageIndex, r);
      setTimeout(() => setShowThanks(false), 2000);
    },
    [rating, feedbackGiven, messageIndex, onFeedback]
  );

  return (
    <div className={cn("group flex flex-col", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-muted text-foreground"
        )}
      >
        {renderContent(content)}
      </div>

      {/* US-406: Menu item cards */}
      {matchedItems.length > 0 && (
        <div className="mt-2 flex w-full max-w-[85%] flex-col gap-1.5">
          {matchedItems.map((item) => (
            <MenuItemCard
              key={item.code}
              code={item.code}
              name={item.name}
              price={item.price}
              id={item.id}
            />
          ))}
        </div>
      )}

      {/* US-407: Feedback icons */}
      {isAssistant && messageIndex !== undefined && onFeedback && (
        <div className="mt-1 flex items-center gap-1">
          <button
            onClick={() => handleFeedback("up")}
            disabled={!!rating || feedbackGiven}
            className={cn(
              "rounded p-1 transition-colors",
              rating === "up"
                ? "text-green-600"
                : "text-muted-foreground/50 hover:text-green-600 md:opacity-0 md:group-hover:opacity-100",
              (rating || feedbackGiven) && "cursor-default"
            )}
            aria-label="Helpful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleFeedback("down")}
            disabled={!!rating || feedbackGiven}
            className={cn(
              "rounded p-1 transition-colors",
              rating === "down"
                ? "text-red-500"
                : "text-muted-foreground/50 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100",
              (rating || feedbackGiven) && "cursor-default"
            )}
            aria-label="Not helpful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          {showThanks && (
            <span className="text-xs text-muted-foreground animate-in fade-in">
              Thanks!
            </span>
          )}
        </div>
      )}
    </div>
  );
}
