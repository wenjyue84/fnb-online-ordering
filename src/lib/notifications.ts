/**
 * WhatsApp notification delivery with exponential backoff retry.
 * Falls back to email (Resend) when WhatsApp fails after all retries.
 *
 * Reads config from env vars:
 *   WHATSAPP_API_URL   - endpoint that accepts { to, message } POST
 *   WHATSAPP_API_KEY   - bearer token for the API
 *   WAITER_WHATSAPP_NUMBER - destination phone (e.g. "601XXXXXXXXX")
 *   RESEND_API_KEY     - Resend API key for email fallback
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

export type NotificationStatus = "pending" | "sent" | "failed" | "skipped" | "email_fallback";

// ---------------------------------------------------------------------------
// Email fallback (Resend)
// ---------------------------------------------------------------------------

function formatOrderEmailHtml(payload: OrderNotificationPayload): string {
  const itemRows = payload.items
    .map(
      (item) =>
        `<tr><td style="padding:4px 8px;">${item.quantity}x ${item.name}</td>` +
        `<td style="padding:4px 8px;text-align:right;">RM ${(item.price * item.quantity).toFixed(2)}</td></tr>`
    )
    .join("");

  const eta = new Date(payload.estimatedArrival).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222;">
  <h2 style="color:#b45309;">⚠️ WhatsApp Failed — New Pre-Order</h2>
  <p>WhatsApp notification could not be delivered after 3 retries. Details below:</p>
  <table style="border-collapse:collapse;width:100%;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
    <thead>
      <tr style="background:#fef3c7;">
        <th style="padding:8px;text-align:left;">Item</th>
        <th style="padding:8px;text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr style="background:#f9fafb;">
        <td style="padding:8px;font-weight:bold;">Total</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">RM ${payload.total.toFixed(2)}</td>
      </tr>
    </tfoot>
  </table>
  <p><strong>Customer:</strong> ${payload.contactNumber}</p>
  <p><strong>ETA:</strong> ${eta}</p>
  <p><strong>Order ID:</strong> #${payload.orderId}</p>
  <hr style="margin:16px 0;border:none;border-top:1px solid #e5e7eb;" />
  <p style="color:#6b7280;font-size:12px;">Please enter this order into FeedMe POS or manage it at <a href="/admin">the admin dashboard</a>.</p>
</body>
</html>`;
}

/**
 * Send a fallback email via Resend when WhatsApp fails.
 * Reads RESEND_API_KEY from env. Reads waiterEmail from site settings.
 * Never throws.
 */
async function sendEmailFallback(
  payload: OrderNotificationPayload,
  waiterEmail: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email-fallback] RESEND_API_KEY not configured — skipping email for order #${payload.orderId}`);
    return false;
  }
  if (!waiterEmail) {
    console.warn(`[email-fallback] No waiterEmail configured — skipping email for order #${payload.orderId}`);
    return false;
  }

  const subject = `[URGENT] New Pre-Order — #${payload.orderId} — WhatsApp failed`;
  const html = formatOrderEmailHtml(payload);

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "Makan Moments <orders@fnb-online-order.vercel.app>",
      to: [waiterEmail],
      subject,
      html,
    });
    if (error) throw new Error(error.message);
    console.info(`[email-fallback] Sent for order #${payload.orderId} to ${waiterEmail} at ${new Date().toISOString()}`);
    return true;
  } catch (err) {
    console.error(
      `[email-fallback] FAILED for order #${payload.orderId}:`,
      err instanceof Error ? err.message : err,
      `at ${new Date().toISOString()}`
    );
    return false;
  }
}

/**
 * Send a WhatsApp notification for a new order, with retry.
 * Falls back to email (Resend) when WhatsApp fails after all retries.
 * Updates the `notification_status` column in tray_orders.
 *
 * Never throws — a notification failure must never break order submission.
 */
export async function sendOrderWhatsAppNotification(
  payload: OrderNotificationPayload,
  waiterEmail?: string
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

    // Attempt email fallback
    const emailSent = await sendEmailFallback(payload, waiterEmail ?? "");
    if (emailSent) {
      await sql`UPDATE tray_orders SET notification_status = 'email_fallback' WHERE id = ${payload.orderId}`;
      return "email_fallback";
    }

    await sql`UPDATE tray_orders SET notification_status = 'failed' WHERE id = ${payload.orderId}`;
    return "failed";
  }
}
