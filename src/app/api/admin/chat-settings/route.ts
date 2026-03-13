import { readChatSettings, writeChatSettings, DEFAULT_SETTINGS } from "@/lib/chat/settings";
import { invalidateSystemPromptCache } from "@/lib/chat/system-prompt";

export const runtime = "nodejs";

export async function GET() {
  const settings = await readChatSettings();
  return Response.json(settings);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const current = await readChatSettings();

    const updated = {
      systemPromptPrefix:
        typeof body.systemPromptPrefix === "string"
          ? body.systemPromptPrefix
          : current.systemPromptPrefix,
      model:
        body.model === "groq" || body.model === "openrouter"
          ? body.model
          : current.model,
      temperature:
        typeof body.temperature === "number" &&
        body.temperature >= 0 &&
        body.temperature <= 2
          ? body.temperature
          : current.temperature,
    } satisfies typeof DEFAULT_SETTINGS;

    await writeChatSettings(updated);
    invalidateSystemPromptCache();

    return Response.json({ ok: true, settings: updated });
  } catch (err) {
    console.error("[chat-settings] Failed to save:", err);
    return Response.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
