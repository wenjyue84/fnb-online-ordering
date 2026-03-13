/**
 * Pre-order submission verification script
 * Posts a clearly-marked test order to /api/orders and confirms HTTP 201 + order ID.
 *
 * Usage: node scripts/verify-order-submit.mjs
 * Requires: npm run dev (server must be running on port 3031)
 *
 * IMPORTANT: After running, delete the test order from /admin > Orders tab.
 */

const BASE_URL = "http://localhost:3031";

// Estimated arrival: 30 minutes from now
const estimatedArrival = new Date(Date.now() + 31 * 60 * 1000).toISOString();

const testOrder = {
  items: [
    {
      id: "TEST-VERIFY",
      nameEn: "VERIFY TEST — DELETE ME",
      price: 1.0,
      quantity: 1,
    },
  ],
  total: 1.0,
  contactNumber: "0123456789",
  estimatedArrival,
};

async function main() {
  console.log("Submitting test order to POST /api/orders...");
  console.log("  Item:", testOrder.items[0].nameEn);
  console.log("  Arrival:", estimatedArrival);

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testOrder),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    console.error(`FAIL: Could not connect to ${BASE_URL}. Is the dev server running?`);
    console.error(`  Error: ${err.message}`);
    process.exit(1);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    console.error(`FAIL: Response was not valid JSON (HTTP ${res.status})`);
    process.exit(1);
  }

  if (res.status === 201 && body.id) {
    console.log(`\nPASS: Order saved — ID: ${body.id}`);
    console.log(
      "\nIMPORTANT: Open http://localhost:3031/admin > Orders tab and delete this test order."
    );
  } else {
    console.error(`\nFAIL: Expected HTTP 201 with { id }, got HTTP ${res.status}`);
    console.error("  Response body:", JSON.stringify(body, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
