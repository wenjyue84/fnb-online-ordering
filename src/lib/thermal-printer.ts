/**
 * Web Serial API thermal receipt printer (ESC/POS).
 * Works with Epson TM / Star Micronics and compatible 58mm/80mm printers.
 * Connection is cached in-session so subsequent prints skip the permission prompt.
 */

// Web Serial API type shims (not yet in lib.dom.d.ts)
interface SerialPort {
  writable: WritableStream<Uint8Array> | null;
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  requestPort(options?: object): Promise<SerialPort>;
}

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

// ── ESC/POS command constants ────────────────────────────────────────────────

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_SIZE: [GS, 0x21, 0x11],
  NORMAL_SIZE: [GS, 0x21, 0x00],
  CUT: [GS, 0x56, 0x00],
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrintableOrder {
  id: number | string;
  items: { name: string; quantity: number; price: number }[];
  total: number | string;
  contact_number?: string;
  estimated_arrival?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function text(s: string): number[] {
  return Array.from(encoder.encode(s));
}

function padRight(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function separator(width: number): number[] {
  return [...text("-".repeat(width)), LF];
}

/** Mask phone number: show last 4 digits, replace other digits with X */
export function maskContact(phone: string): string {
  if (phone.length <= 4) return phone;
  return phone.slice(0, -4).replace(/\d/g, "X") + phone.slice(-4);
}

// ── Connection management ────────────────────────────────────────────────────

let cachedPort: SerialPort | null = null;

export function isSerialSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.serial;
}

export async function connectPrinter(): Promise<SerialPort> {
  if (cachedPort) {
    try {
      if (cachedPort.writable) return cachedPort;
    } catch {
      cachedPort = null;
    }
  }

  const serial = navigator.serial;
  if (!serial) throw new Error("Web Serial API not supported");

  const port = await serial.requestPort();
  await port.open({ baudRate: 9600 });
  cachedPort = port;
  return port;
}

// ── Ticket printing ──────────────────────────────────────────────────────────

export async function printTicket(
  order: PrintableOrder,
  cafeName: string,
): Promise<void> {
  const port = await connectPrinter();
  const writer = port.writable!.getWriter();

  const W = 32; // 58mm receipt = ~32 chars; 80mm = ~48 chars
  const bytes: number[] = [];

  // Initialize
  bytes.push(...CMD.INIT);

  // Cafe name — centered, bold
  bytes.push(...CMD.CENTER, ...CMD.BOLD_ON);
  bytes.push(...text(cafeName), LF);
  bytes.push(...CMD.BOLD_OFF);

  // Date/time
  bytes.push(...text(new Date().toLocaleString("en-MY")), LF);

  // Separator
  bytes.push(...CMD.LEFT);
  bytes.push(...separator(W));

  // Order ID — centered, double size
  bytes.push(...CMD.CENTER, ...CMD.DOUBLE_SIZE, ...CMD.BOLD_ON);
  bytes.push(...text(`#${order.id}`), LF);
  bytes.push(...CMD.NORMAL_SIZE, ...CMD.BOLD_OFF);

  // Separator
  bytes.push(...CMD.LEFT);
  bytes.push(...separator(W));

  // Items
  for (const item of order.items) {
    const qty = `${item.quantity}x `;
    const price = `RM${(item.price * item.quantity).toFixed(2)}`;
    const nameMaxLen = W - qty.length - price.length;
    const name =
      item.name.length > nameMaxLen
        ? item.name.slice(0, nameMaxLen)
        : padRight(item.name, nameMaxLen);
    bytes.push(...text(`${qty}${name}${price}`), LF);
  }

  // Separator
  bytes.push(...separator(W));

  // Total — bold
  bytes.push(...CMD.BOLD_ON);
  const totalStr = `RM ${Number(order.total).toFixed(2)}`;
  bytes.push(
    ...text(`${padRight("TOTAL", W - totalStr.length)}${totalStr}`),
    LF,
  );
  bytes.push(...CMD.BOLD_OFF);

  // Separator
  bytes.push(...separator(W));

  // Contact (masked)
  if (order.contact_number) {
    bytes.push(...text(`Contact: ${maskContact(order.contact_number)}`), LF);
  }

  // ETA
  if (order.estimated_arrival) {
    const eta = new Date(order.estimated_arrival).toLocaleTimeString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
    });
    bytes.push(...text(`ETA: ${eta}`), LF);
  }

  // Thank you
  bytes.push(LF);
  bytes.push(...CMD.CENTER, ...text("Thank you!"), LF);

  // Feed + cut
  bytes.push(LF, LF, LF);
  bytes.push(...CMD.CUT);

  await writer.write(new Uint8Array(bytes));
  writer.releaseLock();
}
