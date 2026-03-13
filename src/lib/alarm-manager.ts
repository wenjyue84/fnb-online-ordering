/**
 * AlarmManager — singleton Web Audio API alarm system for staff pages (KDS/admin).
 * Levels:
 *   'chime'  — pleasant 2-note tone (C5+E5), plays once for new orders
 *   'urgent' — 880Hz beep burst x3, repeats every 30s for escalated orders
 *
 * Usage (client-side only):
 *   import { getAlarmManager } from '@/lib/alarm-manager';
 *   getAlarmManager().play('chime');
 *   getAlarmManager().stop();
 */

const MUTED_KEY = "alarm_muted";
const VOLUME_KEY = "alarm_volume";

class AlarmManager {
  private ctx: AudioContext | null = null;
  private _muted = false;
  private _volume = 0.7;
  private _snoozedUntil = 0;
  private _urgentInterval: ReturnType<typeof setInterval> | null = null;
  private _snoozeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this._muted = localStorage.getItem(MUTED_KEY) === "true";
      const v = parseFloat(localStorage.getItem(VOLUME_KEY) ?? "");
      if (!isNaN(v)) this._volume = Math.max(0, Math.min(1, v));
    } catch {
      // localStorage unavailable (private mode)
    }
  }

  private getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  get isMuted(): boolean {
    return this._muted;
  }

  get volume(): number {
    return this._volume;
  }

  get isSnoozed(): boolean {
    return Date.now() < this._snoozedUntil;
  }

  get snoozeEndMs(): number {
    return this._snoozedUntil;
  }

  get contextState(): "running" | "suspended" | "closed" | "unknown" {
    const ctx = this.getCtx();
    if (!ctx) return "unknown";
    return ctx.state as "running" | "suspended" | "closed";
  }

  // ── Controls ─────────────────────────────────────────────────────────────

  /** Call from a user-gesture handler to resume a suspended AudioContext. */
  unlock(): void {
    const ctx = this.getCtx();
    if (ctx?.state === "suspended") {
      void ctx.resume();
    }
  }

  setMuted(value: boolean): void {
    this._muted = value;
    try {
      localStorage.setItem(MUTED_KEY, String(value));
    } catch {}
    if (value) this.stopUrgent();
  }

  setVolume(value: number): void {
    this._volume = Math.max(0, Math.min(1, value));
    try {
      localStorage.setItem(VOLUME_KEY, String(this._volume));
    } catch {}
  }

  snooze(minutes: number): void {
    this._snoozedUntil = Date.now() + minutes * 60_000;
    this.stopUrgent();
    if (this._snoozeTimer) clearTimeout(this._snoozeTimer);
    this._snoozeTimer = setTimeout(() => {
      this._snoozedUntil = 0;
    }, minutes * 60_000);
  }

  // ── Playback ─────────────────────────────────────────────────────────────

  play(level: "chime" | "urgent"): void {
    if (this._muted || this.isSnoozed) return;
    const ctx = this.getCtx();
    if (!ctx || ctx.state !== "running") return;
    if (level === "chime") {
      this.playChime(ctx);
    } else {
      this.startUrgent(ctx);
    }
  }

  /** Stop the repeating urgent alarm (call when escalation is resolved). */
  stop(): void {
    this.stopUrgent();
  }

  // ── Private audio primitives ─────────────────────────────────────────────

  private playChime(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // C5 (523 Hz) then E5 (659 Hz) — pleasant major third
    [523, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t + i * 0.3);
      gain.gain.setValueAtTime(this._volume * 0.5, t + i * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.3 + 0.25);
      osc.start(t + i * 0.3);
      osc.stop(t + i * 0.3 + 0.3);
    });
  }

  private playUrgentBurst(ctx: AudioContext): void {
    const t = ctx.currentTime;
    // 3 rapid A5 (880 Hz) square-wave beeps: 100ms on / 100ms off
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.setValueAtTime(880, t + i * 0.2);
      gain.gain.setValueAtTime(this._volume * 0.35, t + i * 0.2);
      gain.gain.setValueAtTime(0.001, t + i * 0.2 + 0.1);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.12);
    }
  }

  private startUrgent(ctx: AudioContext): void {
    this.stopUrgent();
    this.playUrgentBurst(ctx);
    this._urgentInterval = setInterval(() => {
      if (this._muted || this.isSnoozed) {
        this.stopUrgent();
        return;
      }
      const c = this.getCtx();
      if (c?.state === "running") this.playUrgentBurst(c);
    }, 30_000);
  }

  private stopUrgent(): void {
    if (this._urgentInterval) {
      clearInterval(this._urgentInterval);
      this._urgentInterval = null;
    }
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

let instance: AlarmManager | null = null;

export function getAlarmManager(): AlarmManager {
  if (!instance) instance = new AlarmManager();
  return instance;
}
