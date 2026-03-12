import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

// ─── MCP Tool Definitions ───────────────────────────────────────────

const TOOLS = [
  {
    name: "fnb_get_menu",
    description:
      "Get the full cafe menu with prices, dietary info, and availability. Returns all available menu items from Makan Moments Cafe.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description:
            "Optional: filter by POS category (e.g. 'Rice Plates', 'Noodles', 'Drinks')",
        },
        available_only: {
          type: "boolean",
          description: "If true (default), only return currently available items",
        },
      },
    },
  },
  {
    name: "fnb_get_menu_item",
    description:
      "Get details for a specific menu item by its POS code (e.g. BF02, NS01, C130). Returns name, price, description, dietary tags, and availability.",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: {
          type: "string",
          description: "The POS item code (e.g. BF02, NS01)",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "fnb_get_categories",
    description:
      "List all menu categories with item counts. Shows how the menu is organized.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "fnb_check_order_status",
    description:
      "Check the status of a customer's pre-order by order ID number. Returns current status (pending, approved, preparing, ready, etc).",
    inputSchema: {
      type: "object" as const,
      properties: {
        order_id: {
          type: "number",
          description: "The numeric order ID",
        },
      },
      required: ["order_id"],
    },
  },
  {
    name: "fnb_get_recent_orders",
    description:
      "Get recent orders for the cafe. Useful for checking order volume and status overview. Returns the most recent 20 orders.",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description:
            "Optional: filter by status (pending_approval, approved, preparing, ready, rejected, expired)",
        },
      },
    },
  },
  {
    name: "fnb_get_cafe_info",
    description:
      "Get cafe information including name, address, hours, phone, WiFi password, featured dishes, FAQ, and pairing suggestions for Makan Moments Cafe.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// ─── Tool Handlers ──────────────────────────────────────────────────

async function handleGetMenu(args: Record<string, unknown>) {
  const availableOnly = args.available_only !== false;
  const category = args.category as string | undefined;

  let query;
  if (availableOnly) {
    query = await sql`
      SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
             is_signature, featured, description
      FROM menu_items
      WHERE available = true AND (archived IS NULL OR archived = false)
      ORDER BY sort_order ASC, name_en ASC
    `;
  } else {
    query = await sql`
      SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
             is_signature, featured, description
      FROM menu_items
      WHERE (archived IS NULL OR archived = false)
      ORDER BY sort_order ASC, name_en ASC
    `;
  }

  let items = query;
  if (category) {
    const cat = category.toLowerCase();
    items = items.filter((item: Record<string, unknown>) => {
      const cats = item.categories as string[] | null;
      return cats?.some((c: string) => c.toLowerCase().includes(cat));
    });
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
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
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleGetMenuItem(args: Record<string, unknown>) {
  const code = (args.code as string)?.toUpperCase();
  if (!code) {
    return {
      content: [{ type: "text", text: "Error: code is required" }],
      isError: true,
    };
  }

  const rows = await sql`
    SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available,
           is_signature, featured, description, available_days, time_from, time_until
    FROM menu_items
    WHERE code = ${code}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      content: [
        { type: "text", text: `Menu item with code "${code}" not found` },
      ],
      isError: true,
    };
  }

  const item = rows[0];
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            code: item.code,
            name_en: item.name_en,
            name_ms: item.name_ms,
            name_zh: item.name_zh,
            price: `RM ${item.price}`,
            categories: item.categories,
            dietary: item.dietary,
            available: item.available,
            featured: item.featured,
            signature: item.is_signature,
            description: item.description,
            available_days: item.available_days,
            time_from: item.time_from,
            time_until: item.time_until,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleGetCategories() {
  const rows = await sql`
    SELECT dc.name, dc.sort_order, dc.active, COUNT(idc.item_id)::int AS item_count
    FROM display_categories dc
    LEFT JOIN item_display_categories idc ON idc.display_category_id = dc.id
    GROUP BY dc.id, dc.name, dc.sort_order, dc.active
    ORDER BY dc.sort_order ASC, dc.name ASC
  `;

  // Also get POS categories from menu_items
  const posCategories = await sql`
    SELECT DISTINCT unnest(categories) AS category
    FROM menu_items
    WHERE available = true AND (archived IS NULL OR archived = false)
    ORDER BY category
  `;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            display_categories: rows,
            pos_categories: posCategories.map(
              (r: Record<string, unknown>) => r.category
            ),
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleCheckOrderStatus(args: Record<string, unknown>) {
  const orderId = Number(args.order_id);
  if (isNaN(orderId)) {
    return {
      content: [{ type: "text", text: "Error: valid order_id is required" }],
      isError: true,
    };
  }

  const rows = await sql`
    SELECT id, items, total, status, contact_number, estimated_arrival,
           estimated_ready, rejection_reason, created_at
    FROM tray_orders
    WHERE id = ${orderId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      content: [
        { type: "text", text: `Order #${orderId} not found` },
      ],
      isError: true,
    };
  }

  const order = rows[0];

  // Auto-expire check
  if (
    order.status === "approved" &&
    Date.now() - new Date(order.created_at as string).getTime() >
      30 * 60 * 1000
  ) {
    await sql`UPDATE tray_orders SET status = 'expired' WHERE id = ${orderId}`;
    order.status = "expired";
  }

  const statusMessages: Record<string, string> = {
    pending_approval: "Order submitted, waiting for cafe to review",
    approved: "Order approved! Awaiting payment via Touch 'n Go",
    payment_uploaded: "Payment received, being verified",
    preparing: "Kitchen is preparing your order",
    ready: "Your order is ready for pickup!",
    rejected: `Order was rejected: ${order.rejection_reason || "No reason given"}`,
    expired: "Order expired (no payment within 30 minutes)",
    cancelled: "Order was cancelled",
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            order_id: order.id,
            status: order.status,
            status_message:
              statusMessages[order.status as string] || String(order.status),
            items: order.items,
            total: `RM ${order.total}`,
            contact: order.contact_number,
            estimated_arrival: order.estimated_arrival,
            estimated_ready: order.estimated_ready,
            created_at: order.created_at,
          },
          null,
          2
        ),
      },
    ],
  };
}

async function handleGetRecentOrders(args: Record<string, unknown>) {
  const status = args.status as string | undefined;

  let rows;
  if (status) {
    rows = await sql`
      SELECT id, items, total, status, contact_number, created_at
      FROM tray_orders
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT 20
    `;
  } else {
    rows = await sql`
      SELECT id, items, total, status, contact_number, created_at
      FROM tray_orders
      ORDER BY created_at DESC
      LIMIT 20
    `;
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            order_count: rows.length,
            orders: rows.map((o: Record<string, unknown>) => ({
              id: o.id,
              status: o.status,
              total: `RM ${o.total}`,
              items: o.items,
              contact: o.contact_number,
              created_at: o.created_at,
            })),
          },
          null,
          2
        ),
      },
    ],
  };
}

function handleGetCafeInfo() {
  // Read knowledge files for comprehensive cafe info
  const knowledgeDir = join(process.cwd(), "knowledge");
  let cafeFactsContent = "";
  let faqContent = "";

  try {
    cafeFactsContent = readFileSync(join(knowledgeDir, "cafe-facts.md"), "utf-8");
  } catch {
    cafeFactsContent = "Makan Moments Cafe — Thai-Malaysian fusion, NO PORK NO LARD, Halal-friendly. Open daily 11AM–11PM.";
  }

  try {
    faqContent = readFileSync(join(knowledgeDir, "faq.md"), "utf-8");
  } catch {
    faqContent = "";
  }

  return {
    content: [
      {
        type: "text",
        text: `${cafeFactsContent}\n\n${faqContent}`,
      },
    ],
  };
}

// ─── Tool Dispatcher ────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  switch (name) {
    case "fnb_get_menu":
      return handleGetMenu(args);
    case "fnb_get_menu_item":
      return handleGetMenuItem(args);
    case "fnb_get_categories":
      return handleGetCategories();
    case "fnb_check_order_status":
      return handleCheckOrderStatus(args);
    case "fnb_get_recent_orders":
      return handleGetRecentOrders(args);
    case "fnb_get_cafe_info":
      return handleGetCafeInfo();
    default:
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// ─── MCP JSON-RPC Handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method, params, id: reqId } = body;

    // MCP protocol: JSON-RPC 2.0
    if (method === "initialize") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: reqId,
        result: {
          protocolVersion: "2024-11-05",
          serverInfo: {
            name: "fnb-online-ordering",
            version: "1.0.0",
          },
          capabilities: { tools: {} },
        },
      });
    }

    if (method === "tools/list") {
      return NextResponse.json({
        jsonrpc: "2.0",
        id: reqId,
        result: { tools: TOOLS },
      });
    }

    if (method === "tools/call") {
      const { name, arguments: toolArgs } = params || {};
      if (!name) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: reqId,
            error: { code: -32602, message: "Tool name required" },
          },
          { status: 400 }
        );
      }

      const result = await executeTool(name, toolArgs || {});
      return NextResponse.json({
        jsonrpc: "2.0",
        id: reqId,
        result,
      });
    }

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: reqId,
        error: { code: -32601, message: `Unknown method: ${method}` },
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("[MCP]", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : "Internal error",
        },
      },
      { status: 500 }
    );
  }
}

// Health/discovery GET endpoint — lists available tools
export async function GET() {
  return NextResponse.json({
    name: "Makan Moments Cafe MCP Server",
    description:
      "MCP server for Makan Moments Cafe — Thai-Malaysian fusion. Provides menu, orders, and cafe info tools.",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    protocol: "json-rpc-2.0",
    endpoint: "POST /api/mcp",
  });
}
