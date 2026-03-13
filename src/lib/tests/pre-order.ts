import type { TestDefinition, TestResult } from "./types";

function getBaseUrl(): string {
  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3031";
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3031";
}

// Helper: future time ISO string
function futureIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Test 1: Valid order submission → 201 + status=pending_approval
// ---------------------------------------------------------------------------
const testValidSubmit: TestDefinition = {
  id: "pre-order-001-valid-submit",
  name: "US-056: Valid order submission",
  description: "POST /api/orders with valid data → 201, status=pending_approval in DB",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    const baseUrl = getBaseUrl();
    let insertedId: number | null = null;
    const logs: string[] = [];

    try {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: "TEST-056", name: "Test Item (US-056)", price: 5.0, quantity: 1 }],
          total: 5.0,
          contactNumber: "0123456789",
          estimatedArrival: futureIso(20),
        }),
      });

      if (res.status !== 201) {
        const body = await res.text();
        return {
          pass: false,
          log: `POST /api/orders => ${res.status} (expected 201): ${body}`,
          duration: Date.now() - start,
        };
      }

      const data = (await res.json()) as { ok: boolean; id: number };
      if (!data.ok || typeof data.id !== "number") {
        return {
          pass: false,
          log: `Unexpected response body: ${JSON.stringify(data)}`,
          duration: Date.now() - start,
        };
      }
      insertedId = data.id;
      logs.push(`PASS: POST /api/orders => 201, order id=${insertedId}`);

      // Verify DB record
      const sql = (await import("@/lib/db")).default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await sql`SELECT id, status FROM tray_orders WHERE id = ${insertedId}`;
      if (rows.length === 0) {
        logs.push(`FAIL: order id=${insertedId} not found in DB`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      if (rows[0].status !== "pending_approval") {
        logs.push(`FAIL: expected status=pending_approval, got ${rows[0].status as string}`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      logs.push(`PASS: order in DB with status=pending_approval`);

      return { pass: true, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    } finally {
      if (insertedId !== null) {
        try {
          const sql = (await import("@/lib/db")).default;
          await sql`DELETE FROM tray_orders WHERE id = ${insertedId}`;
          logs.push(`INFO: Test order id=${insertedId} cleaned up`);
        } catch { /* ignore */ }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Test 2: Invalid phone number → 400
// ---------------------------------------------------------------------------
const testInvalidPhone: TestDefinition = {
  id: "pre-order-002-invalid-phone",
  name: "US-056: Invalid phone rejected",
  description: "POST /api/orders with invalid phone → 400 error",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    const baseUrl = getBaseUrl();

    try {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: "TEST-056", name: "Test Item", price: 5.0, quantity: 1 }],
          total: 5.0,
          contactNumber: "12345",  // invalid: too short, not Malaysian format
          estimatedArrival: futureIso(20),
        }),
      });

      if (res.status === 400) {
        const body = (await res.json()) as { error?: string };
        return {
          pass: true,
          log: `PASS: POST /api/orders with invalid phone => 400: "${body.error ?? ""}"`,
          duration: Date.now() - start,
        };
      }

      return {
        pass: false,
        log: `FAIL: expected 400, got ${res.status}`,
        duration: Date.now() - start,
      };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// ---------------------------------------------------------------------------
// Test 3: Arrival time < 15 min → 400
// ---------------------------------------------------------------------------
const testInvalidTime: TestDefinition = {
  id: "pre-order-003-invalid-time",
  name: "US-056: Arrival < 15 min rejected",
  description: "POST /api/orders with arrival 5 min from now → 400 error",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    const baseUrl = getBaseUrl();

    try {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ id: "TEST-056", name: "Test Item", price: 5.0, quantity: 1 }],
          total: 5.0,
          contactNumber: "0123456789",
          estimatedArrival: futureIso(5),  // only 5 min — should be rejected
        }),
      });

      if (res.status === 400) {
        const body = (await res.json()) as { error?: string };
        return {
          pass: true,
          log: `PASS: POST /api/orders with arrival=+5min => 400: "${body.error ?? ""}"`,
          duration: Date.now() - start,
        };
      }

      return {
        pass: false,
        log: `FAIL: expected 400 for arrival < 15 min, got ${res.status}`,
        duration: Date.now() - start,
      };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// ---------------------------------------------------------------------------
// Test 4: Status flow — DB-level happy path
// ---------------------------------------------------------------------------
const testStatusFlow: TestDefinition = {
  id: "pre-order-004-status-flow",
  name: "US-056: Status transitions (DB-level)",
  description: "Insert test order, advance through all statuses via DB, verify each step",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    const logs: string[] = [];
    let insertedId: number | null = null;

    try {
      const sql = (await import("@/lib/db")).default;

      // Insert test order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insertRows: any[] = await sql`
        INSERT INTO tray_orders (items, total, status, contact_number, estimated_arrival)
        VALUES (
          ${JSON.stringify([{ id: "TEST-056-FLOW", name: "Flow Test Item", price: 5, quantity: 1 }])},
          5.00,
          'pending_approval',
          '0123456789',
          ${futureIso(30)}
        )
        RETURNING id
      `;
      insertedId = insertRows[0].id as number;
      logs.push(`PASS: order inserted id=${insertedId}, status=pending_approval`);

      // Advance: pending_approval → approved
      await sql`UPDATE tray_orders SET status = 'approved', estimated_ready = ${futureIso(30)} WHERE id = ${insertedId}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let row: any[] = await sql`SELECT status FROM tray_orders WHERE id = ${insertedId}`;
      if (row[0]?.status !== "approved") {
        logs.push(`FAIL: expected approved, got ${row[0]?.status as string}`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      logs.push("PASS: pending_approval → approved");

      // Advance: approved → payment_uploaded
      await sql`UPDATE tray_orders SET status = 'payment_uploaded', payment_screenshot_url = '/test-screenshot.jpg' WHERE id = ${insertedId}`;
      row = await sql`SELECT status FROM tray_orders WHERE id = ${insertedId}`;
      if (row[0]?.status !== "payment_uploaded") {
        logs.push(`FAIL: expected payment_uploaded, got ${row[0]?.status as string}`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      logs.push("PASS: approved → payment_uploaded");

      // Advance: payment_uploaded → preparing
      await sql`UPDATE tray_orders SET status = 'preparing' WHERE id = ${insertedId}`;
      row = await sql`SELECT status FROM tray_orders WHERE id = ${insertedId}`;
      if (row[0]?.status !== "preparing") {
        logs.push(`FAIL: expected preparing, got ${row[0]?.status as string}`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      logs.push("PASS: payment_uploaded → preparing");

      // Advance: preparing → ready
      await sql`UPDATE tray_orders SET status = 'ready' WHERE id = ${insertedId}`;
      row = await sql`SELECT status FROM tray_orders WHERE id = ${insertedId}`;
      if (row[0]?.status !== "ready") {
        logs.push(`FAIL: expected ready, got ${row[0]?.status as string}`);
        return { pass: false, log: logs.join("\n"), duration: Date.now() - start };
      }
      logs.push("PASS: preparing → ready ✓ Full flow complete");

      return { pass: true, log: logs.join("\n"), duration: Date.now() - start };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    } finally {
      if (insertedId !== null) {
        try {
          const sql = (await import("@/lib/db")).default;
          await sql`DELETE FROM tray_orders WHERE id = ${insertedId}`;
          logs.push(`INFO: Test order id=${insertedId} cleaned up`);
        } catch { /* ignore */ }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Test 5: Auto-expiry logic present in GET /api/orders/[id]
// ---------------------------------------------------------------------------
const testAutoExpiry: TestDefinition = {
  id: "pre-order-005-auto-expiry",
  name: "US-056: Auto-expiry logic in GET /api/orders/[id]",
  description: "GET /api/orders/[id] route contains 30-min expiry check for approved orders",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const routePath = path.join(process.cwd(), "src", "app", "api", "orders", "[id]", "route.ts");
      const src = fs.readFileSync(routePath, "utf-8");
      const duration = Date.now() - start;

      const hasExpiredStatus = src.includes("'expired'") || src.includes('"expired"');
      const hasApprovedCheck = src.includes("'approved'") || src.includes('"approved"');
      const hasThirtyMin = src.includes("30") && (src.includes("60") || src.includes("minute") || src.includes("min"));

      const logs: string[] = [];
      if (!hasExpiredStatus) {
        logs.push("FAIL: route does not reference 'expired' status");
      }
      if (!hasApprovedCheck) {
        logs.push("FAIL: route does not check for 'approved' status in expiry logic");
      }
      if (!hasThirtyMin) {
        logs.push("FAIL: route does not appear to have 30-minute expiry window");
      }

      const pass = hasExpiredStatus && hasApprovedCheck && hasThirtyMin;
      if (pass) {
        logs.push("PASS: GET /api/orders/[id] has auto-expiry for approved orders (30 min)");
      }
      return { pass, log: logs.join("\n"), duration };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

// ---------------------------------------------------------------------------
// Test 6: Admin filter tabs include Expired
// ---------------------------------------------------------------------------
const testAdminExpiredFilter: TestDefinition = {
  id: "pre-order-006-admin-expired-filter",
  name: "US-056: Admin Orders tab has Expired filter",
  description: "admin-orders-panel.tsx includes 'Expired' filter tab for expired orders",
  category: "pre-order",
  run: async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "src", "components", "admin", "admin-orders-panel.tsx");
      const src = fs.readFileSync(filePath, "utf-8");
      const duration = Date.now() - start;

      const hasExpiredTab = src.includes('"Expired"') || src.includes("'Expired'");
      const hasExpiredStatus = src.includes("'expired'") || src.includes('"expired"');

      const logs: string[] = [];
      if (!hasExpiredTab) logs.push("FAIL: 'Expired' filter tab not found in admin-orders-panel.tsx");
      if (!hasExpiredStatus) logs.push("FAIL: 'expired' status not referenced in admin-orders-panel.tsx");

      const pass = hasExpiredTab && hasExpiredStatus;
      if (pass) logs.push("PASS: Admin Orders tab has Expired filter with expired status handling");
      return { pass, log: logs.join("\n"), duration };
    } catch (err) {
      return { pass: false, log: `Error: ${String(err)}`, duration: Date.now() - start };
    }
  },
};

export const preOrderTests: TestDefinition[] = [
  testValidSubmit,
  testInvalidPhone,
  testInvalidTime,
  testStatusFlow,
  testAutoExpiry,
  testAdminExpiredFilter,
];
