import sql from "@/lib/db";

export interface ChatSettings {
  systemPromptPrefix: string;
  model: "groq" | "openrouter";
  temperature: number;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  systemPromptPrefix: "",
  model: "groq",
  temperature: 0.7,
};

export async function readChatSettings(): Promise<ChatSettings> {
  try {
    const rows = await sql<{ value: Record<string, unknown> }>`
      SELECT value FROM site_settings WHERE key = 'chat'
    `;
    if (!rows.length) return { ...DEFAULT_SETTINGS };
    const parsed = rows[0].value;
    return {
      systemPromptPrefix:
        typeof parsed.systemPromptPrefix === "string"
          ? parsed.systemPromptPrefix
          : DEFAULT_SETTINGS.systemPromptPrefix,
      model:
        parsed.model === "groq" || parsed.model === "openrouter"
          ? (parsed.model as ChatSettings["model"])
          : DEFAULT_SETTINGS.model,
      temperature:
        typeof parsed.temperature === "number" &&
        parsed.temperature >= 0 &&
        parsed.temperature <= 2
          ? parsed.temperature
          : DEFAULT_SETTINGS.temperature,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeChatSettings(settings: ChatSettings): Promise<void> {
  await sql`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES ('chat', ${JSON.stringify(settings)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
}
