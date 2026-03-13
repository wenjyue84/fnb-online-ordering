"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function KdsLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kds/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        router.push("/kds");
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Incorrect PIN");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-xs rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black text-white">Kitchen Display</h1>
          <p className="mt-1 text-sm text-gray-400">Enter your PIN to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">PIN</label>
            <input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setPin(v);
              }}
              required
              autoFocus
              placeholder="••••"
              maxLength={6}
              className="w-full rounded-xl border border-gray-600 bg-gray-700 px-4 py-4 text-center text-2xl font-bold tracking-widest text-white outline-none placeholder-gray-600 focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-900/40 px-4 py-3 text-center text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full rounded-xl bg-orange-500 py-4 text-lg font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
