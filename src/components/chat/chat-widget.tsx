"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import Link from "next/link";

const ChatPanel = dynamic(() => import("./chat-panel").then((mod) => mod.ChatPanel), {
  ssr: false,
});

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    fetch("/api/admin/verify", { credentials: "include", redirect: "manual" })
      .then((r) => setIsAdmin(r.ok))
      .catch(() => setIsAdmin(false));
  }, []);

  function handleOpen() {
    setOpen(true);
    setHasUnread(false);
  }

  return (
    <>
      {/* Chat Panel */}
      {open && (
        <>
          {/* Mobile: full-screen overlay */}
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md md:hidden">
            <ChatPanel onClose={() => setOpen(false)} />
          </div>

          {/* Desktop: floating panel */}
          <div className="fixed bottom-20 right-4 z-50 hidden h-[600px] w-[400px] overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-2xl backdrop-blur-md md:block">
            <ChatPanel onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* Admin gear icon */}
      {isAdmin && (
        <Link
          href="/admin/chat-settings"
          className="fixed bottom-[4.5rem] right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm transition-colors hover:bg-amber-200 md:bottom-4 md:right-20"
          aria-label="AI Waiter Settings"
          title="AI Waiter Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
      )}

      {/* Floating button */}
      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={cn(
          "fixed bottom-[4.5rem] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 sm:bottom-4",
          open && "md:flex hidden",
        )}
        aria-label="Open AI Waiter chat"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}

        {/* Unread badge */}
        {!open && hasUnread && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" aria-label="New message" />
        )}
      </button>
    </>
  );
}
