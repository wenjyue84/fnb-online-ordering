import { type NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { jwtVerify } from "jose";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function getSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

async function verifyAdminCookie(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;
  try {
    await jwtVerify(match[1], getSecret());
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const valid = await verifyAdminCookie(cookieHeader);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const escalationMinutes = Math.max(1, Number(url.searchParams.get("em") || "10"));

  const sql = neon(process.env.DATABASE_URL!);

  const stream = new ReadableStream({
    async start(controller) {
      let lastCheck = new Date().toISOString();
      let heartbeatAt = Date.now();
      let active = true;
      // Track which order IDs have already had an escalation event emitted this session
      const escalationNotifiedIds = new Set<string>();

      request.signal.addEventListener("abort", () => {
        active = false;
        try { controller.close(); } catch { /* already closed */ }
      });

      const send = (data: string) => {
        try {
          controller.enqueue(new TextEncoder().encode(data));
        } catch {
          active = false;
        }
      };

      // Initial heartbeat
      send(": ping\n\n");

      while (active) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!active) break;

        try {
          const now = new Date().toISOString();

          // Check for new orders
          const rows = await sql`
            SELECT id, total, items, created_at
            FROM tray_orders
            WHERE status = 'pending_approval'
              AND created_at > ${lastCheck}
            ORDER BY created_at ASC
          `;
          lastCheck = now;

          for (const row of rows) {
            const items = Array.isArray(row.items) ? row.items : [];
            const payload = JSON.stringify({
              id: row.id,
              total: row.total,
              itemCount: items.length,
              createdAt: row.created_at,
            });
            send(`event: new_order\ndata: ${payload}\n\n`);
          }

          // Check for overdue pending_approval orders (escalation)
          const overdueRows = await sql`
            SELECT id, created_at
            FROM tray_orders
            WHERE status = 'pending_approval'
              AND created_at < NOW() - (${escalationMinutes} * INTERVAL '1 minute')
            ORDER BY created_at ASC
          `;

          for (const row of overdueRows) {
            const orderId = String(row.id);
            if (!escalationNotifiedIds.has(orderId)) {
              escalationNotifiedIds.add(orderId);
              const minutesOverdue = Math.floor(
                (Date.now() - new Date(row.created_at as string).getTime()) / 60_000
              ) - escalationMinutes;
              const payload = JSON.stringify({ id: row.id, minutesOverdue });
              send(`event: escalation\ndata: ${payload}\n\n`);
            }
          }
        } catch {
          // DB error — continue loop, don't close stream
        }

        // Send heartbeat every 20s
        if (Date.now() - heartbeatAt >= 20_000) {
          send(": ping\n\n");
          heartbeatAt = Date.now();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
