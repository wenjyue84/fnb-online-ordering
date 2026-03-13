"use client";

import { useEffect, useState, useCallback } from "react";
import { getAlarmManager } from "@/lib/alarm-manager";

interface AlarmControlsProps {
  /** Extra Tailwind classes for the wrapper */
  className?: string;
  /** Dark theme — used on KDS (dark bg). Light theme — used on admin header. */
  theme?: "dark" | "light";
}

/**
 * AlarmControls — mute toggle, volume slider, and snooze button.
 * Shares state with the AlarmManager singleton so all instances stay in sync.
 * Also shows "Enable Sound" if the AudioContext is still suspended (requires
 * a user gesture to unlock Web Audio).
 */
export function AlarmControls({ className = "", theme = "light" }: AlarmControlsProps) {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [snoozeEnd, setSnoozeEnd] = useState(0);
  const [snoozeLabel, setSnoozeLabel] = useState<string | null>(null);
  const [ctxSuspended, setCtxSuspended] = useState(false);

  // Initialise from AlarmManager on mount (client only)
  useEffect(() => {
    const am = getAlarmManager();
    setMuted(am.isMuted);
    setVolume(am.volume);
    setSnoozeEnd(am.snoozeEndMs);
    setCtxSuspended(am.contextState === "suspended");
  }, []);

  // Snooze countdown ticker
  useEffect(() => {
    if (snoozeEnd === 0) {
      setSnoozeLabel(null);
      return;
    }
    function tick() {
      const diff = snoozeEnd - Date.now();
      if (diff <= 0) {
        setSnoozeEnd(0);
        setSnoozeLabel(null);
        return;
      }
      const mins = Math.floor(diff / 60_000);
      const secs = Math.floor((diff % 60_000) / 1_000);
      setSnoozeLabel(`${mins}:${String(secs).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [snoozeEnd]);

  const handleMuteToggle = useCallback(() => {
    const am = getAlarmManager();
    const next = !muted;
    am.setMuted(next);
    setMuted(next);
  }, [muted]);

  const handleVolume = useCallback((v: number) => {
    getAlarmManager().setVolume(v);
    setVolume(v);
  }, []);

  const handleSnooze = useCallback(() => {
    getAlarmManager().snooze(5);
    const end = Date.now() + 5 * 60_000;
    setSnoozeEnd(end);
  }, []);

  const handleUnlock = useCallback(() => {
    getAlarmManager().unlock();
    setCtxSuspended(false);
  }, []);

  const isDark = theme === "dark";
  const btn = isDark
    ? "rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
    : "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Enable Sound — shown when AudioContext not yet unlocked */}
      {ctxSuspended && (
        <button
          onClick={handleUnlock}
          className={`${btn} ${
            isDark
              ? "bg-orange-600 text-white hover:bg-orange-500"
              : "bg-orange-100 text-orange-800 hover:bg-orange-200"
          }`}
          title="Click to enable alarm sounds"
        >
          🔔 Enable Sound
        </button>
      )}

      {/* Mute toggle */}
      <button
        onClick={handleMuteToggle}
        title={muted ? "Unmute alarms" : "Mute alarms"}
        className={`${btn} ${
          isDark
            ? muted
              ? "bg-gray-700 text-gray-400 hover:bg-gray-600"
              : "bg-orange-600 text-white hover:bg-orange-500"
            : muted
              ? "bg-gray-200 text-gray-500 hover:bg-gray-300"
              : "bg-orange-100 text-orange-800 hover:bg-orange-200"
        }`}
        aria-label={muted ? "Unmute alarms" : "Mute alarms"}
      >
        {muted ? "🔇" : "🔔"}
      </button>

      {/* Volume slider */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => handleVolume(parseFloat(e.target.value))}
        disabled={muted}
        aria-label="Alarm volume"
        className="w-20 accent-orange-500 disabled:opacity-40"
      />

      {/* Snooze */}
      {snoozeLabel ? (
        <span
          className={`text-xs font-medium ${
            isDark ? "text-yellow-400" : "text-yellow-700"
          }`}
          title="Alarms snoozed"
        >
          💤 {snoozeLabel}
        </span>
      ) : (
        <button
          onClick={handleSnooze}
          title="Snooze all alarms for 5 minutes"
          className={`${btn} ${
            isDark
              ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Snooze 5m
        </button>
      )}
    </div>
  );
}
