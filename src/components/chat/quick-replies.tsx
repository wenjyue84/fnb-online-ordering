"use client";

import { useCallback } from "react";

type SuggestionSet = "initial" | "ordering" | "menu";

interface QuickRepliesProps {
  messages: Array<{ role: string; content: string }>;
  onSend: (text: string) => void;
  isTyping: boolean;
  isLoading: boolean;
}

const SUGGESTIONS: Record<SuggestionSet, string[]> = {
  initial: ["What's popular?", "Show me the menu", "I want to order"],
  ordering: ["Check order status", "Add more items", "That's all"],
  menu: ["Any vegetarian options?", "What's under RM15?", "Recommend something"],
};

function detectContext(messages: Array<{ role: string; content: string }>): SuggestionSet {
  const recent = messages.slice(-4);
  const text = recent.map((m) => m.content.toLowerCase()).join(" ");

  if (/tray|order|added|submit|checkout/i.test(text)) return "ordering";
  if (/menu|dish|food|rice|noodle|drink|price|rm\s?\d/i.test(text)) return "menu";
  return "initial";
}

export function QuickReplies({ messages, onSend, isTyping, isLoading }: QuickRepliesProps) {
  const context = detectContext(messages);
  const suggestions = SUGGESTIONS[context];

  const handleClick = useCallback(
    (text: string) => {
      onSend(text);
    },
    [onSend]
  );

  // Hide when user is typing or AI is loading
  if (isTyping || isLoading) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 scrollbar-none">
      {suggestions.map((text) => (
        <button
          key={text}
          onClick={() => handleClick(text)}
          className="min-h-[44px] shrink-0 whitespace-nowrap rounded-full border border-primary/30 bg-background px-4 py-2 text-sm text-primary transition-colors hover:bg-primary/10 active:bg-primary/20"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
