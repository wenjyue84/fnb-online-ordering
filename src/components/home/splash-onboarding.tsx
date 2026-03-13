"use client";

import { useEffect, useState } from "react";
import { X, Utensils, Send, Smile } from "lucide-react";

const SPLASH_KEY = "mm_splash_seen";

export function SplashOnboarding() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay splash so the LCP hero image can paint and be registered first.
    // Without this, the fixed z-50 backdrop covers the hero and inflates LCP to ~5s.
    const timer = setTimeout(() => {
      if (!localStorage.getItem(SPLASH_KEY)) {
        setVisible(true);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(SPLASH_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const steps = [
    {
      icon: <Utensils className="h-5 w-5 text-amber-800" />,
      title: "Browse Menu",
      desc: "Explore our Thai-Malaysian fusion dishes and add favourites to your tray.",
    },
    {
      icon: <Send className="h-5 w-5 text-amber-800" />,
      title: "Pre-Order Online",
      desc: "Submit your order with your arrival time — we'll have it ready for you.",
    },
    {
      icon: <Smile className="h-5 w-5 text-amber-800" />,
      title: "Arrive & Enjoy",
      desc: "Walk in, sit down, and your food will be waiting. No queue, no wait.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome splash"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-[oklch(0.97_0.02_80)] p-6 shadow-2xl sm:rounded-3xl">
        {/* Dismiss button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-stone-200 text-stone-600 transition hover:bg-stone-300"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Headline */}
        <h2 className="font-display text-2xl font-bold leading-tight text-stone-900">
          Pre-Order &amp; Skip the Wait
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Browse our menu, send your order online, and arrive to find your food
          ready.
        </p>

        {/* Steps */}
        <ol className="mt-5 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                {step.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-stone-800">
                  {step.title}
                </p>
                <p className="text-xs text-stone-500">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* CTA */}
        <button
          onClick={dismiss}
          className="mt-6 w-full rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-800 active:scale-95"
        >
          Got it — Let&apos;s Eat!
        </button>
      </div>
    </div>
  );
}
