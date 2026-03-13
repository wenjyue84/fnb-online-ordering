/**
 * WhatsApp notification delivery with exponential backoff retry.
 *
 * Reads config from env vars:
 *   WHATSAPP_API_URL   - endpoint that accepts { to, message } POST
 *   WHATSAPP_API_KEY   - bearer token for the API
 *   WAITER_WHATSAPP_NUMBER - destination phone (e.g. "601XXXXXXXXX")
 */

import sql from "@/lib/db";

// ---------------------------------------------------------------------------
// Generic retry helper
// ---------------------------------------------------------------------------

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

/**
 * Retry an async function up to `maxRetries` times with exponential backoff.
 * Delays: baseDelayMs * 2^attempt (1s, 2s, 4s by default).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000 } = opts;

  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// WhatsApp notification
// ---------------------------------------------------------------------------

interface OrderNotificationPayload {
  orderId: number;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  contactNumber: string;
  estimatedArrival: string;
}

function formatOrderMessage(payload: OrderNotificationPayload): string {
  const lines: string[] = [
    `*New Pre-Order #${payload.orderId}*`,
    "",
    ...payload.items.map(
      (item) => `${item.quantity}x ${item.name} — RM ${(item.price * item.quantity).toFixed(2)}`
    ),
    "",
    `*Total: RM ${payload.total.toFixed(2)}*`,
    `Phone: ${payload.contactNumber}`,
    `ETA: ${new Date(payload.estimatedArrival).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}`,
    "",
    "Please enter this order into FeedMe POS.",
  ];
  return lines.join("\n");
}

async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiKey = process.env.WHATSAPP_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error("WhatsApp API not configured (WHATSAPP_API_URL / WHATSAPP_API_KEY missing)");
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ to, message }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WhatsApp API responded ${res.status}: ${text}`);
  }
}

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

/**
 * Send a WhatsApp notification for a new order, with retry.
 * Updates the `notification_status` column in tray_orders.
 *
 * Never throws — a notification failure must never break order submission.
 */
export async function sendOrderWhatsAppNotification(
  payload: OrderNotificationPayload
): Promise<NotificationStatus> {
  const waiterNumber = process.env.WAITER_WHATSAPP_NUMBER;
  const apiUrl = process.env.WHATSAPP_API_URL;

  // If WhatsApp is not configured, skip silently
  if (!waiterNumber || !apiUrl) {
    console.info(`[whatsapp] Skipped for order #${payload.orderId} — not configured`);
    await sql`UPDATE tray_orders SET notification_status = 'skipped' WHERE id = ${payload.orderId}`;
    return "skipped";
  }

  const message = formatOrderMessage(payload);

  let attemptNum = 0;
  try {
    await withRetry(() => {
      attemptNum++;
      console.info(`[whatsapp] Attempt ${attemptNum} for order #${payload.orderId}`);
      return sendWhatsAppMessage(waiterNumber, message);
    }, {
      maxRetries: 3,
      baseDelayMs: 1000,
    });

    await sql`UPDATE tray_orders SET notification_status = 'sent' WHERE id = ${payload.orderId}`;
    console.info(`[whatsapp] Sent for order #${payload.orderId}`);
    return "sent";
  } catch (err) {
    console.error(
      `[whatsapp] FAILED after 3 retries for order #${payload.orderId}:`,
      err instanceof Error ? err.message : err
    );
    await sql`UPDATE tray_orders SET notification_status = 'failed' WHERE id = ${payload.orderId}`;
    return "failed";
  }
}
