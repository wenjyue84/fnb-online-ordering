import { readOperatingHours, writeOperatingHours } from "@/lib/availability";
import type { OperatingHoursConfig } from "@/lib/availability";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(await readOperatingHours());
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<OperatingHoursConfig>;
    const fields: (keyof OperatingHoursConfig)[] = [
      "openHour", "openMinute", "lastOrderHour", "lastOrderMinute", "closeHour", "closeMinute",
    ];
    for (const f of fields) {
      if (typeof body[f] !== "number") {
        return Response.json({ error: `${f} must be a number` }, { status: 400 });
      }
    }
    await writeOperatingHours(body as OperatingHoursConfig);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[operating-hours] Failed to save:", err);
    return Response.json({ error: "Failed to save" }, { status: 500 });
  }
}
