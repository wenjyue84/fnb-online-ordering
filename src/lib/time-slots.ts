import sql from "@/lib/db";

export type { TimeSlot, TimeSlotsConfig } from "./time-slots-shared";
export { DEFAULT_TIME_SLOTS } from "./time-slots-shared";

import type { TimeSlotsConfig, TimeSlot } from "./time-slots-shared";
import { DEFAULT_TIME_SLOTS } from "./time-slots-shared";

export async function readTimeSlots(): Promise<TimeSlotsConfig> {
  try {
    const rows = await sql<{ value: TimeSlotsConfig }>`
      SELECT value FROM site_settings WHERE key = 'time_slots'
    `;
    if (!rows.length) return { ...DEFAULT_TIME_SLOTS };
    const val = rows[0].value as TimeSlotsConfig;
    if (Array.isArray(val.slots)) return val;
    return { ...DEFAULT_TIME_SLOTS };
  } catch {
    return { ...DEFAULT_TIME_SLOTS };
  }
}

export async function writeTimeSlots(config: TimeSlotsConfig): Promise<void> {
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('time_slots', ${JSON.stringify(config)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
}

function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Returns current Malaysia time hour and minute using server timezone API */
function getMalaysiaTime(): { hour: number; minute: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return { hour, minute };
}

/** Returns the current Malaysia time formatted for display, e.g. "11:45 AM". */
export function getMalaysiaTimeString(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

/** Returns the active slot for a given hour/minute, or null if outside all slots. */
async function getActiveSlotForTime(hour: number, minute: number): Promise<TimeSlot | null> {
  const config = await readTimeSlots();
  const now = toMinutes(hour, minute);
  for (const slot of config.slots) {
    const start = toMinutes(slot.startHour, slot.startMinute);
    const end = toMinutes(slot.endHour, slot.endMinute);
    if (now >= start && now < end) return slot;
  }
  return null;
}

/** Returns the active time slot for the current Malaysia time, or null if outside all slots. */
export async function getActiveSlot(): Promise<TimeSlot | null> {
  const { hour, minute } = getMalaysiaTime();
  return getActiveSlotForTime(hour, minute);
}

/**
 * Returns the default category for the given time (HH:MM), or current Malaysia time if omitted.
 * @param overrideTime - Optional "HH:MM" string, e.g. "08:00" for admin preview.
 */
export async function getDefaultCategoryForTime(overrideTime?: string | null): Promise<string | null> {
  if (overrideTime) {
    const [h, m] = overrideTime.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      return (await getActiveSlotForTime(h, m))?.defaultCategory ?? null;
    }
  }
  return (await getActiveSlot())?.defaultCategory ?? null;
}

/**
 * Returns the set of "serving now" default categories (Display Category names).
 * Falls back to Chef's Picks when outside all time windows.
 * @param overrideTime - Optional "HH:MM" string for admin preview.
 */
export async function getServingNowCategories(overrideTime?: string | null): Promise<string[]> {
  if (overrideTime) {
    const [h, m] = overrideTime.split(":").map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      const slot = await getActiveSlotForTime(h, m);
      return slot ? [slot.defaultCategory] : ["Chef's Picks"];
    }
  }
  const slot = await getActiveSlot();
  return slot ? [slot.defaultCategory] : ["Chef's Picks"];
}
