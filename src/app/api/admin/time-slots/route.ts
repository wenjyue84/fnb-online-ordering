import { readTimeSlots, writeTimeSlots } from "@/lib/time-slots";
import type { TimeSlotsConfig } from "@/lib/time-slots";

export const runtime = "nodejs";

export async function GET() {
  const config = await readTimeSlots();
  return Response.json(config);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<TimeSlotsConfig>;
    if (!Array.isArray(body.slots)) {
      return Response.json({ error: "slots array required" }, { status: 400 });
    }
    await writeTimeSlots({ slots: body.slots });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[time-slots] Failed to save:", err);
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }
}
