import { readFileSync } from "fs";
import { join } from "path";
import { readChatSettings } from "./settings";
import { getSiteSettings } from "@/lib/site-settings";
import sql from "@/lib/db";
import { getServingNowCategories } from "@/lib/time-slots";

// Static file cache — cleared on invalidation only
let staticKnowledgeCache: { cafeFacts: string; faq: string } | null = null;
// Menu DB cache — auto-expires after 60 minutes
let menuCache: { text: string; expiresAt: number } | null = null;
// Rainbow AI KB cache — auto-expires after 5 minutes
let rainbowKBCache: { systemPrompt: string; kbFiles: string[]; cachedAt: number; expiresAt: number } | null = null;

const MENU_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes
const RAINBOW_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function loadKnowledge(filename: string): string {
  try {
    return readFileSync(
      join(process.cwd(), "knowledge", filename),
      "utf-8"
    );
  } catch {
    return "";
  }
}

type MenuRow = {
  code: string;
  name_en: string;
  name_ms: string;
  name_zh: string;
  price: string | number;
  categories: string[] | string;
  dietary: string[] | string;
  available: boolean;
};

function formatMenuRow(row: MenuRow): string {
  const price = typeof row.price === "number" ? row.price.toFixed(2) : row.price;
  const dietary = Array.isArray(row.dietary) ? row.dietary.filter(Boolean).join(",") : (row.dietary ?? "");
  const tag = dietary ? ` [${dietary}]` : "";
  return `${row.code} ${row.name_en} RM${price}${tag}`;
}

async function fetchMenuFromDB(): Promise<string> {
  if (menuCache && Date.now() < menuCache.expiresAt) {
    return menuCache.text;
  }

  try {
    const rows = await sql`
      SELECT code, name_en, name_ms, name_zh, price, categories, dietary, available
      FROM menu_items
      ORDER BY sort_order ASC
    `;

    if (!rows || rows.length === 0) {
      return loadKnowledge("menu-knowledge.md");
    }

    const available = (rows as MenuRow[]).filter((r) => r.available);
    const unavailable = (rows as MenuRow[]).filter((r) => !r.available);

    const availableSection = available.length > 0
      ? `CURRENTLY AVAILABLE ITEMS:\n${available.map(formatMenuRow).join("\n")}`
      : "CURRENTLY AVAILABLE ITEMS:\n(none)";

    const unavailableSection = unavailable.length > 0
      ? `ITEMS NOT AVAILABLE TODAY (do not say the cafe does not have these — say they are not available today and suggest an alternative):\n${unavailable.map(formatMenuRow).join("\n")}`
      : "";

    const text = unavailableSection
      ? `${availableSection}\n\n${unavailableSection}`
      : availableSection;

    menuCache = { text, expiresAt: Date.now() + MENU_CACHE_TTL_MS };
    return text;
  } catch (err) {
    console.error("[system-prompt] Failed to fetch menu from DB, falling back to static file:", err);
    return loadKnowledge("menu-knowledge.md");
  }
}

/**
 * US-403: Fetch KB context from Rainbow AI if enabled.
 * Returns the static knowledge portion (cafe-facts + faq) from Rainbow AI.
 * Falls back to local files on failure.
 */
async function fetchRainbowKBContext(): Promise<{ cafeFacts: string; faq: string } | null> {
  const rainbowEnabled = process.env.RAINBOW_AI_ENABLED === "true";
  const rainbowUrl = process.env.RAINBOW_AI_URL;

  if (!rainbowEnabled || !rainbowUrl) return null;

  if (rainbowKBCache && Date.now() < rainbowKBCache.expiresAt) {
    return { cafeFacts: rainbowKBCache.systemPrompt, faq: "" };
  }

  try {
    const response = await fetch(
      `${rainbowUrl}/api/chat/makan-moments/kb-context`,
      { signal: AbortSignal.timeout(3000) }
    );

    if (!response.ok) {
      console.warn(`[system-prompt] Rainbow AI returned ${response.status}, falling back to local KB`);
      return null;
    }

    const data = await response.json() as { systemPrompt: string; kbFiles: string[]; cachedAt: number };
    rainbowKBCache = { ...data, expiresAt: Date.now() + RAINBOW_CACHE_TTL_MS };

    return { cafeFacts: data.systemPrompt, faq: "" };
  } catch (err) {
    console.warn("[system-prompt] Rainbow AI fetch failed, falling back to local KB:", err);
    return null;
  }
}

async function buildKnowledgeBlock(): Promise<string> {
  // Try Rainbow AI first (US-403)
  const rainbowKB = await fetchRainbowKBContext();

  if (rainbowKB) {
    const menuKnowledge = await fetchMenuFromDB();
    return `## Cafe Knowledge (from Rainbow AI)
${rainbowKB.cafeFacts}

## Menu Knowledge (Live from Database)
${menuKnowledge}`;
  }

  // Fallback: local files
  if (!staticKnowledgeCache) {
    staticKnowledgeCache = {
      cafeFacts: loadKnowledge("cafe-facts.md"),
      faq: loadKnowledge("faq.md"),
    };
  }

  const menuKnowledge = await fetchMenuFromDB();

  return `## Cafe Facts
${staticKnowledgeCache.cafeFacts}

## Menu Knowledge (Live from Database)
${menuKnowledge}

## FAQ
${staticKnowledgeCache.faq}`;
}

/**
 * US-404: Build time context section for the system prompt.
 * Computed fresh on every call (not cached).
 */
async function buildTimeContext(): Promise<string> {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  const dayStr = new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
  }).format(now);

  const servingCategories = await getServingNowCategories();

  return `## TIME CONTEXT
Current time: ${timeStr} (${dayStr})
Currently serving: ${servingCategories.join(", ")}
When a customer asks what to eat or for recommendations, prioritize items from the currently serving categories.`;
}

export function invalidateSystemPromptCache(): void {
  staticKnowledgeCache = null;
  menuCache = null;
  rainbowKBCache = null;
}

export async function getSystemPrompt(): Promise<string> {
  const settings = await readChatSettings();
  const { cafeName } = await getSiteSettings();
  const [knowledge, timeContext] = await Promise.all([
    buildKnowledgeBlock(),
    buildTimeContext(),
  ]);

  const base = `You are the AI Waiter for ${cafeName || "this cafe"}, a Thai-Malaysian fusion cafe in Skudai, Johor, Malaysia.

## Your Role
- Help customers with menu inquiries, recommendations, and cafe information
- Be friendly, warm, and helpful — like a real waiter
- Respond in the SAME LANGUAGE the customer uses (English, Malay, or Chinese)
- If unsure about the language, default to the language of the most recent message
- Keep responses concise (2-4 sentences for simple questions, more for detailed recommendations)
- Use prices in RM (Malaysian Ringgit)

## Important Rules
- NEVER make up menu items or prices — only reference items from the knowledge below
- The menu knowledge below has two sections: CURRENTLY AVAILABLE ITEMS and ITEMS NOT AVAILABLE TODAY
- If a customer asks about an item in the CURRENTLY AVAILABLE section, answer normally with price and description
- If a customer asks about an item in the ITEMS NOT AVAILABLE TODAY section, say it is not available today and suggest a similar alternative from the available items — NEVER say the cafe does not have it or does not serve it
- If a customer asks about something that does not appear in either section (e.g. pizza, sushi), say the cafe does not serve that and suggest what the cafe does offer
- For allergy or dietary questions, mention that the cafe is NO PORK, NO LARD, Halal-friendly
- When a customer says they want to order or add something, ALWAYS call the \`addToTray\` tool to add it for them
- Do not ask for payment details or process checkout — tell them to show their tray to the human waiter when they are ready
- If they order a main dish, ask if they want any drinks or add-ons (like an egg)
- Be an active seller! If they say "give me 1 nasi lemak", you add it via tool and reply "Added Nasi Lemak to your tray! Would you like to try our famous Thai Milk Tea with that?"
- If asked about delivery, mention they can visit the cafe at Taman Impian Emas, Skudai

ORDER STATUS: If the customer mentions their order number or ID, extract the number and call \`checkOrderStatus(orderId)\`. If no number given, ask first. After you receive the tool result, IMMEDIATELY write your text reply to the customer — relay the "message" field from the tool. NEVER call checkOrderStatus more than once per turn. Do NOT call any tool after receiving the order status result.
SUBMIT ORDER: Can submit pre-orders via chat. Collect items+qty, Malaysian phone, arrival time (min 15min from now). Show order summary+total, get confirmation, then call \`submitOrder\`. Share order ID on success.

${timeContext}

${knowledge}`;

  if (settings.systemPromptPrefix && settings.systemPromptPrefix.trim()) {
    return `${settings.systemPromptPrefix.trim()}\n\n${base}`;
  }

  return base;
}
