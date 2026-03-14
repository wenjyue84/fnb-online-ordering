import { NextResponse, type NextRequest } from "next/server";
import sql, { sqlRaw } from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";
import { getSiteSettings, writeSiteSettings } from "@/lib/site-settings";

export const runtime = "nodejs";

// ── Auth ────────────────────────────────────────────────────────────────────

const MCP_SECRET = process.env.FNB_MCP_SECRET;

function isAdminRequest(req: NextRequest): boolean {
  if (!MCP_SECRET) return false;
  return req.headers.get("x-mcp-secret") === MCP_SECRET;
}

// ── Tool Definitions ────────────────────────────────────────────────────────

const PUBLIC_TOOLS = [
  {
    name: "fnb_get_menu",
    description:
      "Get the full cafe menu with prices, dietary info, and availability. Optionally filter by category or available-only.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Filter by POS category (e.g. 'Rice Plates', 'Noodles', 'Drinks')",
        },
        available_only: {
          type: "boolean",
          description: "Only return currently available items (default: true)",
        },
      },
    },
  },
  {
    name: "fnb_get_menu_item",
    description:
      "Get details for a specific menu item by its POS code (e.g. BF02, NS01). Returns name, price, dietary tags, availability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Item POS code (e.g. BF02)" },
      },
      required: ["code"],
    },
  },
  {
    name: "fnb_get_categories",
    description: "List all display categories and POS categories with item counts.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "fnb_get_cafe_info",
    description:
      "Get cafe information: address, hours, WiFi, featured dishes, FAQ, and pairing suggestions.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "fnb_check_order_status",
    description:
      "Check the status of a customer pre-order by its numeric order ID. Returns status, estimated ready time, and a human-readable message.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "The numeric order ID" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_get_recent_orders",
    description:
      "Get recent orders (last 20). Optionally filter by status. Useful for checking order activity.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description:
            "Filter by status: pending_approval | approved | preparing | ready | rejected | expired",
        },
        limit: {
          type: "number",
          description: "Number of orders to return (default 20, max 50)",
        },
      },
    },
  },
  {
    name: "fnb_submit_order",
    description:
      "Submit a new pre-order for a customer. Requires at least one item, a valid Malaysian phone number, and an estimated arrival at least 15 minutes from now.",
    inputSchema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "List of ordered items",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Menu item POS code" },
              name: { type: "string", description: "Item name" },
              price: { type: "number", description: "Unit price in RM" },
              quantity: { type: "number", description: "Quantity ordered" },
            },
            required: ["id", "name", "price", "quantity"],
          },
        },
        contact_number: {
          type: "string",
          description: "Customer's Malaysian phone number (e.g. 0123456789 or +60123456789)",
        },
        estimated_arrival: {
          type: "string",
          description: "ISO 8601 datetime — must be at least 15 minutes from now",
        },
      },
      required: ["items", "contact_number", "estimated_arrival"],
    },
  },
  {
    name: "fnb_cancel_order",
    description: "Cancel a pending order by order ID. Only orders with status pending_approval can be cancelled.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "Numeric order ID to cancel" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_get_public_settings",
    description:
      "Get public site settings: T&G payment phone/QR, pre-order enabled status, currency, operating hours.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

const ADMIN_TOOLS = [
  {
    name: "fnb_admin_approve_order",
    description:
      "Approve a pending_approval order. Optionally set an estimated ready time. Advances status to approved (or preparing if deposit not required).",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "Order ID to approve" },
        estimated_ready: {
          type: "string",
          description: "Optional ISO 8601 estimated ready time (e.g. 2024-12-01T14:30:00+08:00)",
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_admin_reject_order",
    description: "Reject an order with an optional reason shown to the customer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "Order ID to reject" },
        reason: {
          type: "string",
          description: "Reason for rejection shown to the customer (default: 'Order was rejected')",
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_admin_confirm_payment",
    description: "Confirm that a T&G deposit payment has been received. Advances order to 'preparing'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "Order ID" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_admin_mark_ready",
    description: "Mark an order as ready for customer pickup. Sends push notification to customer.",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: { type: "number", description: "Order ID" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_admin_update_menu_item",
    description:
      "Update a menu item's availability, price, featured status, or description. Only provide fields you want to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Item POS code (e.g. BF02)" },
        available: { type: "boolean", description: "Set item availability" },
        price: { type: "number", description: "New price in RM" },
        featured: { type: "boolean", description: "Set featured/chef's pick status" },
        description: { type: "string", description: "New description text" },
      },
      required: ["code"],
    },
  },
  {
    name: "fnb_admin_get_order_stats",
    description:
      "Get order statistics for a specific date (default: today in KL timezone). Returns order count, revenue, average order value, and pending count.",
    inputSchema: {
      type: "object" as const,
      properties: {
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format. Defaults to today in Asia/Kuala_Lumpur timezone.",
        },
      },
    },
  },
  {
    name: "fnb_admin_get_settings",
    description:
      "Get all site settings: T&G payment info, pre-order toggle, deposit requirement, operating hours, currency, default locale.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "fnb_admin_update_settings",
    description:
      "Update site settings. Only provided fields are changed; others remain unchanged.",
    inputSchema: {
      type: "object" as const,
      properties: {
        preOrderEnabled: { type: "boolean", description: "Enable or disable the pre-order system" },
        depositRequired: {
          type: "boolean",
          description: "Require T&G deposit screenshot before preparing",
        },
        tngPhone: { type: "string", description: "T&G registered phone number displayed to customers" },
        currency: { type: "string", description: "Currency symbol (default: RM)" },
      },
    },
  },
  {
    name: "fnb_admin_get_display_categories",
    description:
      "List all display categories (Chef's Picks, Vegetarian, Under RM15, etc.) with their active status and item counts.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "fnb_admin_toggle_display_category",
    description: "Activate or deactivate a display category by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "Display category ID" },
        active: { type: "boolean", description: "true to activate, false to deactivate" },
      },
      required: ["id", "active"],
    },
  },
  {
    name: "fnb_admin_get_operating_hours",
    description: "Get the cafe's operating hours for each day of the week.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

const ALL_TOOLS = [...PUBLIC_TOOLS, ...ADMIN_TOOLS];

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

// ── Public Tool Handlers ─────────────────────────────────────────────────────

async function handleGetMenu(args: Record<string, unknown>) {
  const availableOnly = args.available_only !== false;
  const category = args.category as string | undefined;

  const rows = availableOnly
    ? await sql`
        SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
               is_signature, featured, description
        FROM menu_items
        WHERE available = true AND (archived IS NULL OR archived = false)
        ORDER BY sort_order ASC, name_en ASC
      `
    : await sql`
        SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
               is_signature, featured, description
        FROM menu_items
        WHERE (archived IS NULL OR archived = false)
        ORDER BY sort_order ASC, name_en ASC
      `;

  const items = category
    ? rows.filter((i: Record<string, unknown>) =>
        (i.categories as string[] | null)?.some((c) =>
          c.toLowerCase().includes((category as string).toLowerCase())
        )
      )
    : rows;

  return ok({
    cafe: "Makan Moments Cafe",
    item_count: items.length,
    items: items.map((i: Record<string, unknown>) => ({
      code: i.code,
      name_en: i.name_en,
      name_ms: i.name_ms,
      name_zh: i.name_zh,
      price: `RM ${i.price}`,
      categories: i.categories,
      dietary: i.dietary,
      available: i.available,
      featured: i.featured,
      signature: i.is_signature,
      description: i.description,
    })),
  });
}

async function handleGetMenuItem(args: Record<string, unknown>) {
  const code = (args.code as string)?.toUpperCase();
  if (!code) return err("code is required");

  const rows = await sql`
    SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
           is_signature, featured, description, available_days, time_from, time_until
    FROM menu_items WHERE code = ${code} LIMIT 1
  `;
  if (!rows.length) return err(`Item "${code}" not found`);

  const i = rows[0];
  return ok({
    code: i.code,
    name_en: i.name_en,
    name_ms: i.name_ms,
    name_zh: i.name_zh,
    price: `RM ${i.price}`,
    categories: i.categories,
    dietary: i.dietary,
    available: i.available,
    featured: i.featured,
    signature: i.is_signature,
    description: i.description,
    available_days: i.available_days,
    time_from: i.time_from,
    time_until: i.time_until,
  });
}

async function handleGetCategories() {
  const displayCats = await sql`
    SELECT dc.id, dc.name, dc.sort_order, dc.active, COUNT(idc.item_id)::int AS item_count
    FROM display_categories dc
    LEFT JOIN item_display_categories idc ON idc.display_category_id = dc.id
    GROUP BY dc.id, dc.name, dc.sort_order, dc.active
    ORDER BY dc.sort_order ASC, dc.name ASC
  `;
  const posCats = await sql`
    SELECT DISTINCT unnest(categories) AS category
    FROM menu_items
    WHERE available = true AND (archived IS NULL OR archived = false)
    ORDER BY category
  `;
  return ok({
    display_categories: displayCats,
    pos_categories: posCats.map((r: Record<string, unknown>) => r.category),
  });
}

function handleGetCafeInfo() {
  const knowledgeDir = join(process.cwd(), "knowledge");
  let cafeFacts = "";
  let faq = "";
  try { cafeFacts = readFileSync(join(knowledgeDir, "cafe-facts.md"), "utf-8"); } catch { /* ignore */ }
  try { faq = readFileSync(join(knowledgeDir, "faq.md"), "utf-8"); } catch { /* ignore */ }
  return ok({ cafe_facts: cafeFacts || "Makan Moments Cafe — Thai-Malaysian fusion, NO PORK NO LARD, Halal-friendly.", faq });
}

async function handleCheckOrderStatus(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");

  const rows = await sql`
    SELECT id, items, total, status, contact_number, estimated_arrival,
           estimated_ready, rejection_reason, created_at
    FROM tray_orders WHERE id = ${id} LIMIT 1
  `;
  if (!rows.length) return ok({ found: false, message: `Order #${id} not found` });

  const order = rows[0];
  // Auto-expire if approved but no payment in 30 min
  if (
    order.status === "approved" &&
    Date.now() - new Date(order.created_at as string).getTime() > 30 * 60 * 1000
  ) {
    await sql`UPDATE tray_orders SET status = 'expired' WHERE id = ${id}`;
    order.status = "expired";
  }

  const statusMessages: Record<string, string> = {
    pending_approval: "Waiting for cafe to confirm",
    approved: "Confirmed — awaiting T&G deposit payment",
    payment_uploaded: "Payment received, being verified",
    preparing: "Kitchen is preparing your order",
    ready: "Order is ready for pickup!",
    rejected: `Rejected: ${order.rejection_reason || "no reason given"}`,
    expired: "Expired — no payment received within 30 minutes",
    cancelled: "Cancelled",
  };

  return ok({
    order_id: order.id,
    status: order.status,
    status_message: statusMessages[order.status as string] ?? String(order.status),
    items: order.items,
    total: `RM ${order.total}`,
    contact: order.contact_number,
    estimated_arrival: order.estimated_arrival,
    estimated_ready: order.estimated_ready,
    created_at: order.created_at,
  });
}

async function handleGetRecentOrders(args: Record<string, unknown>) {
  const status = args.status as string | undefined;
  const limit = Math.min(Number(args.limit) || 20, 50);

  const rows = status
    ? await sql`
        SELECT id, items, total, status, contact_number, created_at
        FROM tray_orders WHERE status = ${status}
        ORDER BY created_at DESC LIMIT ${limit}
      `
    : await sql`
        SELECT id, items, total, status, contact_number, created_at
        FROM tray_orders ORDER BY created_at DESC LIMIT ${limit}
      `;

  return ok({
    count: rows.length,
    orders: rows.map((o: Record<string, unknown>) => ({
      id: o.id,
      status: o.status,
      total: `RM ${o.total}`,
      items: o.items,
      contact: o.contact_number,
      created_at: o.created_at,
    })),
  });
}

const MALAYSIAN_PHONE_RE = /^(\+?60|0)1[0-9]{8,9}$/;

async function handleSubmitOrder(args: Record<string, unknown>) {
  const items = args.items as { id: string; name: string; price: number; quantity: number }[];
  const contactNumber = args.contact_number as string;
  const estimatedArrival = args.estimated_arrival as string;

  if (!Array.isArray(items) || items.length === 0) return err("items array is required and must not be empty");

  const phone = (contactNumber ?? "").replace(/[-\s]/g, "");
  if (!MALAYSIAN_PHONE_RE.test(phone)) return err("Invalid Malaysian phone number");

  const arrival = new Date(estimatedArrival);
  if (isNaN(arrival.getTime()) || arrival <= new Date(Date.now() + 14 * 60 * 1000)) {
    return err("Estimated arrival must be at least 15 minutes from now");
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const rows = await sql<{ id: number }>`
    INSERT INTO tray_orders (items, total, status, contact_number, estimated_arrival)
    VALUES (
      ${JSON.stringify(items)}::jsonb,
      ${total},
      'pending_approval',
      ${phone},
      ${arrival.toISOString()}
    )
    RETURNING id
  `;
  const orderId = rows[0].id;

  // Fire-and-forget WhatsApp notification to waiter
  void sendWaiterWhatsApp(orderId, items, total, phone, arrival.toISOString());

  // Fire-and-forget web push to admin
  void sendAdminWebPush(items.length, total);

  return ok({
    ok: true,
    order_id: orderId,
    message: `Order #${orderId} submitted. The cafe will confirm it shortly.`,
    total: `RM ${total.toFixed(2)}`,
  });
}

async function handleCancelOrder(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");

  const rows = await sql`
    UPDATE tray_orders SET status = 'cancelled'
    WHERE id = ${id} AND status = 'pending_approval'
    RETURNING id, status
  `;
  if (!rows.length) return err(`Order #${id} not found or cannot be cancelled (must be pending_approval)`);
  return ok({ ok: true, order_id: id, status: "cancelled" });
}

async function handleGetPublicSettings() {
  const settings = await getSiteSettings();
  return ok({
    preOrderEnabled: settings.preOrderEnabled,
    tngPhone: settings.tng_phone,
    tngQrUrl: settings.tng_qr_url,
    currency: settings.currency ?? "RM",
    operatingHours: settings.operatingHours,
  });
}

// ── Admin Tool Handlers ──────────────────────────────────────────────────────

async function handleAdminApproveOrder(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");

  const settings = await getSiteSettings();
  const newStatus = settings.depositRequired ? "approved" : "preparing";
  const readyAt = args.estimated_ready ? new Date(args.estimated_ready as string) : null;

  const rows =
    readyAt && !isNaN(readyAt.getTime())
      ? await sql`
          UPDATE tray_orders SET status = ${newStatus}, estimated_ready = ${readyAt.toISOString()}
          WHERE id = ${id} RETURNING id, status, estimated_ready
        `
      : await sql`
          UPDATE tray_orders SET status = ${newStatus}
          WHERE id = ${id} RETURNING id, status
        `;

  if (!rows.length) return err(`Order #${id} not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminRejectOrder(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");
  const reason = ((args.reason as string) ?? "").trim() || "Order was rejected";

  const rows = await sql`
    UPDATE tray_orders SET status = 'rejected', rejection_reason = ${reason}
    WHERE id = ${id} RETURNING id, status, rejection_reason
  `;
  if (!rows.length) return err(`Order #${id} not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminConfirmPayment(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");

  const rows = await sql`
    UPDATE tray_orders SET status = 'preparing' WHERE id = ${id} RETURNING id, status
  `;
  if (!rows.length) return err(`Order #${id} not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminMarkReady(args: Record<string, unknown>) {
  const id = Number(args.order_id);
  if (isNaN(id)) return err("order_id must be a number");

  const rows = await sql`
    UPDATE tray_orders SET status = 'ready' WHERE id = ${id} RETURNING id, status
  `;
  if (!rows.length) return err(`Order #${id} not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminUpdateMenuItem(args: Record<string, unknown>) {
  const code = (args.code as string)?.toUpperCase();
  if (!code) return err("code is required");

  const updates: string[] = [];
  const values: (string | number | boolean)[] = [];

  if (typeof args.available === "boolean") {
    updates.push(`available = $${values.length + 1}`);
    values.push(args.available);
  }
  if (typeof args.price === "number" && args.price > 0) {
    updates.push(`price = $${values.length + 1}`);
    values.push(args.price);
  }
  if (typeof args.featured === "boolean") {
    updates.push(`featured = $${values.length + 1}`);
    values.push(args.featured);
  }
  if (typeof args.description === "string") {
    updates.push(`description = $${values.length + 1}`);
    values.push(args.description);
  }

  if (!updates.length) return err("No fields to update provided");

  // Build dynamic SET clause with parameterized values — $1..$N are already in updates
  const queryText = `UPDATE menu_items SET ${updates.join(", ")} WHERE code = $${values.length + 1} RETURNING code, name_en, price, available, featured`;
  const rows = await sqlRaw(queryText, [...values, code]).catch(() => [] as Record<string, unknown>[]);

  if (!rows.length) return err(`Item "${code}" not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminGetOrderStats(args: Record<string, unknown>) {
  const date =
    (args.date as string) ??
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err("date must be YYYY-MM-DD");

  const rows = await sql<{
    order_count: string;
    revenue: string;
    avg_value: string;
    pending_count: string;
  }>`
    SELECT
      COUNT(*)::TEXT AS order_count,
      COALESCE(SUM(total), 0)::TEXT AS revenue,
      COALESCE(AVG(total), 0)::TEXT AS avg_value,
      COUNT(*) FILTER (WHERE status IN ('pending_approval', 'pending'))::TEXT AS pending_count
    FROM tray_orders
    WHERE DATE(created_at AT TIME ZONE 'Asia/Kuala_Lumpur') = ${date}
      AND status NOT IN ('cancelled', 'rejected')
  `;

  const row = rows[0];
  return ok({
    date,
    order_count: parseInt(row.order_count, 10),
    revenue: parseFloat(parseFloat(row.revenue).toFixed(2)),
    avg_value: parseFloat(parseFloat(row.avg_value).toFixed(2)),
    pending_count: parseInt(row.pending_count, 10),
  });
}

async function handleAdminGetSettings() {
  const settings = await getSiteSettings();
  return ok(settings);
}

async function handleAdminUpdateSettings(args: Record<string, unknown>) {
  const current = await getSiteSettings();
  const updated = { ...current };

  if (typeof args.preOrderEnabled === "boolean") updated.preOrderEnabled = args.preOrderEnabled;
  if (typeof args.depositRequired === "boolean") updated.depositRequired = args.depositRequired as boolean;
  if (typeof args.tngPhone === "string") updated.tng_phone = args.tngPhone;
  if (typeof args.currency === "string") updated.currency = args.currency;

  await writeSiteSettings(updated);
  return ok({ ok: true, settings: updated });
}

async function handleAdminGetDisplayCategories() {
  const rows = await sql`
    SELECT dc.id, dc.name, dc.sort_order, dc.active, COUNT(idc.item_id)::int AS item_count
    FROM display_categories dc
    LEFT JOIN item_display_categories idc ON idc.display_category_id = dc.id
    GROUP BY dc.id, dc.name, dc.sort_order, dc.active
    ORDER BY dc.sort_order ASC, dc.name ASC
  `;
  return ok({ categories: rows });
}

async function handleAdminToggleDisplayCategory(args: Record<string, unknown>) {
  const id = Number(args.id);
  const active = Boolean(args.active);
  if (isNaN(id)) return err("id must be a number");

  const rows = await sql`
    UPDATE display_categories SET active = ${active}
    WHERE id = ${id} RETURNING id, name, active
  `;
  if (!rows.length) return err(`Display category #${id} not found`);
  return ok({ ok: true, ...rows[0] });
}

async function handleAdminGetOperatingHours() {
  const settings = await getSiteSettings();
  return ok({ operating_hours: settings.operatingHours });
}

// ── Notification helpers (fire-and-forget) ───────────────────────────────────

async function sendWaiterWhatsApp(
  orderId: number,
  items: { name: string; quantity: number; price: number }[],
  total: number,
  phone: string,
  arrival: string
) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const waiterNum = process.env.WAITER_WHATSAPP_NUMBER;
  if (!apiUrl || !waiterNum) return;

  const itemLines = items
    .map((i) => `• ${i.name} x${i.quantity} — RM${(i.price * i.quantity).toFixed(2)}`)
    .join("\n");
  const msg = `🍽 New Pre-Order #${orderId}\n\n${itemLines}\n\nTotal: RM${total.toFixed(2)}\nPhone: ${phone}\nArrival: ${new Date(arrival).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}`;

  try {
    await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.WHATSAPP_API_KEY ? { Authorization: `Bearer ${process.env.WHATSAPP_API_KEY}` } : {}),
      },
      body: JSON.stringify({ to: waiterNum, message: msg }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    console.warn("[MCP] WhatsApp notification failed:", e);
  }
}

async function sendAdminWebPush(itemCount: number, total: number) {
  const { default: webpush } = await import("web-push");
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) return;

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@localhost",
      vapidPublic,
      vapidPrivate
    );
    const subs = await sql<{ endpoint: string; p256dh: string; auth: string }>`
      SELECT endpoint, p256dh, auth FROM push_subscriptions
    `;
    if (!subs.length) return;

    const payload = JSON.stringify({
      title: "🍽 New Pre-Order",
      body: `${itemCount} item${itemCount !== 1 ? "s" : ""} — RM ${total.toFixed(2)}`,
      url: "/admin",
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush
          .sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
          .catch(async (e: { statusCode?: number }) => {
            if (e?.statusCode === 410) {
              await sql`DELETE FROM push_subscriptions WHERE endpoint = ${sub.endpoint}`;
            }
          })
      )
    );
  } catch (e) {
    console.warn("[MCP] Web push failed:", e);
  }
}

// ── Tool Dispatcher ──────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  adminAllowed: boolean
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  // Admin tools require admin auth
  if (name.startsWith("fnb_admin_") && !adminAllowed) {
    return err("Admin access required — provide valid X-MCP-Secret header");
  }

  switch (name) {
    case "fnb_get_menu":               return handleGetMenu(args);
    case "fnb_get_menu_item":          return handleGetMenuItem(args);
    case "fnb_get_categories":         return handleGetCategories();
    case "fnb_get_cafe_info":          return handleGetCafeInfo();
    case "fnb_check_order_status":     return handleCheckOrderStatus(args);
    case "fnb_get_recent_orders":      return handleGetRecentOrders(args);
    case "fnb_submit_order":           return handleSubmitOrder(args);
    case "fnb_cancel_order":           return handleCancelOrder(args);
    case "fnb_get_public_settings":    return handleGetPublicSettings();
    case "fnb_admin_approve_order":    return handleAdminApproveOrder(args);
    case "fnb_admin_reject_order":     return handleAdminRejectOrder(args);
    case "fnb_admin_confirm_payment":  return handleAdminConfirmPayment(args);
    case "fnb_admin_mark_ready":       return handleAdminMarkReady(args);
    case "fnb_admin_update_menu_item": return handleAdminUpdateMenuItem(args);
    case "fnb_admin_get_order_stats":  return handleAdminGetOrderStats(args);
    case "fnb_admin_get_settings":     return handleAdminGetSettings();
    case "fnb_admin_update_settings":  return handleAdminUpdateSettings(args);
    case "fnb_admin_get_display_categories":   return handleAdminGetDisplayCategories();
    case "fnb_admin_toggle_display_category":  return handleAdminToggleDisplayCategory(args);
    case "fnb_admin_get_operating_hours":      return handleAdminGetOperatingHours();
    default:
      return err(`Unknown tool: ${name}`);
  }
}

// ── MCP JSON-RPC 2.0 Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id: reqId } = body;
    const admin = isAdminRequest(req);

    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "fnb-online-ordering", version: "2.0.0" },
          capabilities: { tools: {} },
        },
      });
    }

    if (method === "notifications/initialized") {
      // Required handshake — just acknowledge
      return NextResponse.json({ jsonrpc: "2.0", id: reqId, result: {} });
    }

    if (method === "tools/list") {
      // Return public tools always; add admin tools if authenticated
      const tools = admin ? ALL_TOOLS : PUBLIC_TOOLS;
      return NextResponse.json({ jsonrpc: "2.0", id: reqId, result: { tools } });
    }

    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params || {};
      if (!name) {
        return NextResponse.json(
          { jsonrpc: "2.0", id: reqId, error: { code: -32602, message: "Tool name required" } },
          { status: 400 }
        );
      }
      const result = await executeTool(name, toolArgs || {}, admin);
      return NextResponse.json({ jsonrpc: "2.0", id: reqId, result });
    }

    return NextResponse.json(
      { jsonrpc: "2.0", id: reqId, error: { code: -32601, message: `Unknown method: ${method}` } },
      { status: 400 }
    );
  } catch (e) {
    console.error("[MCP]", e);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: e instanceof Error ? e.message : "Internal error" },
      },
      { status: 500 }
    );
  }
}

// ── Discovery GET ─────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    name: "Makan Moments Cafe MCP Server",
    description:
      "MCP server for Makan Moments Cafe — provides menu, orders, and admin management tools.",
    version: "2.0.0",
    protocol: "json-rpc-2.0",
    endpoint: "POST /api/mcp",
    auth: "Admin tools require X-MCP-Secret header (set FNB_MCP_SECRET env var)",
    public_tools: PUBLIC_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    admin_tools: ADMIN_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}
