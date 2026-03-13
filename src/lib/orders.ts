/**
 * Smart ready-time formula for order estimation.
 * Base 10 min + 2 min per unique item line, capped at 30 min.
 */
export function calculateSmartReadyTime(items: { quantity?: number }[]): Date {
  const mins = Math.max(10, Math.min(30, 10 + 2 * items.length));
  return new Date(Date.now() + mins * 60_000);
}

/**
 * Format a Date as a datetime-local string (YYYY-MM-DDTHH:MM)
 * suitable for <input type="datetime-local">.
 */
export function toDatetimeLocal(date: Date): string {
  const d = new Date(date);
  // Round to nearest 5 min
  d.setSeconds(0, 0);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5);
  return d.toISOString().slice(0, 16);
}
