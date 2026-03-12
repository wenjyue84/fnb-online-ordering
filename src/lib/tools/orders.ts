import sql from "@/lib/db";
import { OrderSubmitSchema } from "@/lib/schemas/order";
import webpush from "web-push";
import { getSiteSettings } from "@/lib/site-settings";

// Configure VAPID — only if keys are present
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function sendPushToAllAdmins(itemCount: number, total: number): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;
  try {
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>`SELECT endpoint, p256dh, auth FROM push_subscriptions`;
    const { cafeName } = await getSiteSettings();
    const payload = JSON.stringify({
      title: `🍽 New Order — ${cafeName || "Cafe"}`,
      body: `${itemCount} item${itemCount !== 1 ? "s" : ""} — RM ${total.toFixed(2)}`,
      url: "/admin",
    });
    await Promise.allSettled(
      subs.map((row: { endpoint: string; p256dh: string; auth: string }) =>
        webpush
          .sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload
          )
          .catch(async (err: { statusCode?: number }) => {
            if (err?.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`;
            }
          })
      )
    );
  } catch (err) {
    console.warn("[push] sendPushToAllAdmins failed:", err);
  }
}

/**
 * Look up the current status of a pre-order by numeric ID.
 * Returns a JSON string — suitable for direct return from an AI SDK tool execute().
 */
export async function checkOrderStatusHandler(orderId: string): Promise<string> {
  const id = parseInt(orderId, 10);
  if (isNaN(id)) return JSON.stringify({ error: "Invalid order ID — must be a number" });

  const rows = await sql<{ id: number; status: string; estimated_ready: string | null; created_at: string }>`
    SELECT id, status, estimated_ready, created_at
    FROM tray_orders
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!rows.length) return JSON.stringify({ message: `Order ID ${orderId} was not found. Please double-check the order number.` });

  const row = rows[0];

  // Auto-expire approved orders that are still unpaid after 30 minutes
  if (
    row.status === "approved" &&
    Date.now() - new Date(row.created_at).getTime() > 30 * 60 * 1000
  ) {
    await sql`UPDATE tray_orders SET status = 'expired' WHERE id = ${id}`;
    return JSON.stringify({ message: `Order ID ${orderId} has expired — no payment was received within 30 minutes.` });
  }

  const statusMessages: Record<string, string> = {
    pending_approval: "Your order is waiting for the cafe to confirm it.",
    approved: "Your order has been confirmed! Please proceed to make your T&G deposit.",
    payment_pending: "Your order is awaiting payment.",
    payment_uploaded: "Your payment screenshot has been received. The kitchen will start preparing soon.",
    preparing: "The kitchen is preparing your order right now!",
    ready: "Your order is ready — come on in!",
    rejected: "Unfortunately your order was not accepted. Please contact the cafe directly.",
    seen: "Your order has been seen by the cafe.",
  };

  const statusMessage = statusMessages[row.status] ?? `Order status: ${row.status}`;
  const readyNote = row.estimated_ready ? ` Estimated ready time: ${new Date(row.estimated_ready).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}.` : "";

  return JSON.stringify({ message: `Order #${row.id}: ${statusMessage}${readyNote}` });
}

/**
 * Submit a pre-order on behalf of the customer.
 * Validates input, inserts into tray_orders, and fires a push notification.
 * Returns a JSON string — suitable for direct return from an AI SDK tool execute().
 */
export async function submitOrderHandler(args: {
  items: { id: string; name: string; price: number; quantity: number }[];
  contactNumber: string;
  estimatedArrival: string;
}): Promise<string> {
  const { items, contactNumber, estimatedArrival } = args;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const parsed = OrderSubmitSchema.safeParse({ items, total, contactNumber, estimatedArrival });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    return JSON.stringify({ error: "Validation failed", details: errors });
  }

  const { contactNumber: phone, estimatedArrival: arrival } = parsed.data;

  const rows = await sql`
    INSERT INTO tray_orders (items, total, status, contact_number, estimated_arrival)
    VALUES (
      ${JSON.stringify(items)},
      ${total},
      'pending_approval',
      ${phone},
      ${new Date(arrival).toISOString()}
    )
    RETURNING id
  `;

  void sendPushToAllAdmins(items.length, total);

  return JSON.stringify({
    ok: true,
    orderId: rows[0].id,
    message: "Order submitted! The cafe will review it shortly.",
  });
}
