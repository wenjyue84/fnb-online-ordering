import { readFileSync } from "fs";
import { join } from "path";
import { readChatSettings } from "./settings";
import { getSiteSettings } from "@/lib/site-settings";
import sql from "@/lib/db";

// Static file cache — cleared on invalidation only
let staticKnowledgeCache: { cafeFacts: string; faq: string } | null = null;
// Menu DB cache — auto-expires after 60 minutes
let menuCache: { text: string; expiresAt: number } | null = null;

const MENU_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

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
  // Compact format: saves ~70% tokens vs verbose format (364 items × 30 tokens → ~10 tokens each)
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

async function buildKnowledgeBlock(): Promise<string> {
  // Static files cached until manually invalidated
  if (!staticKnowledgeCache) {
    staticKnowledgeCache = {
      cafeFacts: loadKnowledge("cafe-facts.md"),
      faq: loadKnowledge("faq.md"),
    };
  }

  // Menu fetched from DB with 60-min TTL
  const menuKnowledge = await fetchMenuFromDB();

  return `## Cafe Facts
${staticKnowledgeCache.cafeFacts}

## Menu Knowledge (Live from Database)
${menuKnowledge}

## FAQ
${staticKnowledgeCache.faq}`;
}

export function invalidateSystemPromptCache(): void {
  staticKnowledgeCache = null;
  menuCache = null;
}

export async function getSystemPrompt(): Promise<string> {
  const settings = await readChatSettings();
  const { cafeName } = await getSiteSettings();
  const knowledge = await buildKnowledgeBlock();

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

${knowledge}`;

  if (settings.systemPromptPrefix && settings.systemPromptPrefix.trim()) {
    return `${settings.systemPromptPrefix.trim()}\n\n${base}`;
  }

  return base;
}
