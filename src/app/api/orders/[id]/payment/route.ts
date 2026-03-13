import { NextResponse, type NextRequest } from "next/server";
import sql from "@/lib/db";
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";
import { createRateLimiter } from "@/lib/chat/rate-limit";

export const runtime = "nodejs";

// 10 upload attempts per IP per hour — prevents storage exhaustion / DoS
const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  name: "POST /api/orders/[id]/payment",
});

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Magic byte signatures for allowed image types
const MAGIC_BYTES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  "image/webp": (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
};

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Upload to Vercel Blob (production) or local filesystem (dev fallback) */
async function uploadScreenshot(
  orderId: number,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const ext = EXT_MAP[contentType] ?? "jpg";
  const safeId = String(orderId).replace(/[^a-zA-Z0-9-]/g, "");
  const filename = `payments/${safeId}.${ext}`;

  // Use Vercel Blob when token is available (production / preview)
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url; // Full HTTPS URL
  }

  // Local filesystem fallback for development
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "payments");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, `${safeId}.${ext}`);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/payments/${safeId}.${ext}`;
}

// POST /api/orders/:id/payment — customer uploads TnG payment screenshot
// Public endpoint (order ID acts as a shared secret, no auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting — 10 uploads per IP per hour
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "127.0.0.1";
  const rateCheck = await paymentRateLimiter(ip);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfter ?? 3600) },
      }
    );
  }

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Ensure payment_screenshot_url column exists
    await sql`
      ALTER TABLE tray_orders
      ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT
    `;

    // Check order exists and is awaiting payment
    const orderRows = await sql`
      SELECT id, status FROM tray_orders WHERE id = ${orderId} LIMIT 1
    `;
    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const orderStatus = orderRows[0].status as string;
    if (orderStatus !== "approved" && orderStatus !== "payment_pending") {
      return NextResponse.json(
        { error: "Order is not awaiting payment" },
        { status: 400 }
      );
    }

    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("screenshot") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No screenshot uploaded" },
        { status: 400 }
      );
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are accepted" },
        { status: 400 }
      );
    }

    // Validate size — 413 Payload Too Large
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be smaller than 5MB" },
        { status: 413 }
      );
    }

    // Magic byte check — prevents MIME spoofing
    const arrayBuffer = await file.arrayBuffer();
    const header = new Uint8Array(arrayBuffer.slice(0, 12));
    const magicCheck = MAGIC_BYTES[file.type];
    if (!magicCheck || !magicCheck(header)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, and WebP images are accepted" },
        { status: 400 }
      );
    }

    // Upload to cloud storage (or local fallback)
    const buffer = Buffer.from(arrayBuffer);
    const screenshotUrl = await uploadScreenshot(orderId, buffer, file.type);

    // Update order status
    await sql`
      UPDATE tray_orders
      SET status = 'payment_uploaded',
          payment_screenshot_url = ${screenshotUrl}
      WHERE id = ${orderId}
    `;

    return NextResponse.json({ ok: true, screenshotUrl });
  } catch (err) {
    console.error("[POST /api/orders/[id]/payment]", err);
    return NextResponse.json(
      { error: "Failed to process payment upload" },
      { status: 500 }
    );
  }
}
