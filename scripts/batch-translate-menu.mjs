/**
 * Batch translate missing Malay and Chinese names for all menu items.
 * Uses Groq llama-3.3-70b-versatile, translating 30 items per API call.
 *
 * Usage:
 *   node scripts/batch-translate-menu.mjs
 *   node scripts/batch-translate-menu.mjs --dry-run   (preview without saving)
 *   node scripts/batch-translate-menu.mjs --lang ms    (MS only)
 *   node scripts/batch-translate-menu.mjs --lang zh    (ZH only)
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

// --- Load .env.local ---
function loadEnv() {
  const envPath = join(rootDir, ".env.local");
  // Normalize line endings (handle CRLF on Windows)
  const content = readFileSync(envPath, "utf-8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");
if (!GROQ_API_KEY && !OPENROUTER_API_KEY) throw new Error("No AI API key found");

const sql = neon(DATABASE_URL);

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LANG_FILTER = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : null;
const BATCH_SIZE = 30;

// --- Groq API call ---
async function callGroq(messages) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.15,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

// --- OpenRouter fallback ---
async function callOpenRouter(messages) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct",
      messages,
      temperature: 0.15,
      max_tokens: 2048,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

async function callAI(messages) {
  try {
    return await callGroq(messages);
  } catch (e) {
    console.warn("  Groq failed, trying OpenRouter:", e.message);
    return await callOpenRouter(messages);
  }
}

// --- Translate a batch of items to a target language ---
// Returns an array of translations in the same order as items[]
async function translateBatch(items, lang) {
  const langLabel = lang === "ms" ? "Malay (Bahasa Melayu)" : "Chinese Simplified (中文简体)";

  const list = items.map((item, i) => `${i + 1}. ${item.name_en}`).join("\n");

  const prompt = `You are a food translator specializing in Southeast Asian and Thai-Malaysian fusion cuisine.
Translate ALL these cafe dish names to ${langLabel}.

Rules:
- Return ONLY a valid JSON object with integer keys "1", "2", etc. matching the item numbers
- No explanations, no extra text outside the JSON
- Keep proper nouns (Thai words, brand names) phonetically if no standard translation
- For Chinese: use Simplified Chinese characters (mainland standard)
- For Malay: use standard Bahasa Melayu, not informal/slang
- Translate every single item — do not skip any

Dish names:
${list}

Expected format: {"1": "translation1", "2": "translation2", ...}`;

  const raw = await callAI([
    { role: "system", content: "You are a precise JSON-outputting food translator. Return ONLY valid JSON with integer string keys." },
    { role: "user", content: prompt },
  ]);

  // Extract JSON from response (handle ```json ... ``` wrapping)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`No JSON found in response: ${raw.slice(0, 200)}`);
  const map = JSON.parse(jsonMatch[0]);

  // Convert to ordered array indexed by item position
  return items.map((_, i) => map[String(i + 1)] ?? null);
}

// --- Main ---
async function main() {
  console.log("=== Batch Menu Translation ===");
  if (DRY_RUN) console.log("DRY RUN — no DB updates will be made\n");

  // Fetch all items
  const rows = await sql`SELECT id, name_en, name_ms, name_zh FROM menu_items ORDER BY name_en ASC`;
  console.log(`Total items: ${rows.length}`);

  // Determine what needs translation
  const needsMs = rows.filter((r) => !r.name_ms || r.name_ms.trim() === "");
  const needsZh = rows.filter((r) => !r.name_zh || r.name_zh.trim() === "");

  const langs = [];
  if (!LANG_FILTER || LANG_FILTER === "ms") langs.push({ lang: "ms", items: needsMs });
  if (!LANG_FILTER || LANG_FILTER === "zh") langs.push({ lang: "zh", items: needsZh });

  for (const { lang, items } of langs) {
    const langLabel = lang === "ms" ? "Malay" : "Chinese";
    console.log(`\n--- ${langLabel} (${items.length} items need translation) ---`);
    if (items.length === 0) {
      console.log("  Nothing to do.");
      continue;
    }

    let translated = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(items.length / BATCH_SIZE);
      console.log(`  Batch ${batchNum}/${totalBatches}: translating ${batch.length} items...`);

      let translations;
      try {
        translations = await translateBatch(batch, lang);
      } catch (e) {
        console.error(`  ERROR translating batch ${batchNum}:`, e.message);
        failed += batch.length;
        continue;
      }

      // Update each item in the batch
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const translation = translations[j];
        if (!translation || translation.trim() === "") {
          console.warn(`  SKIP (no translation returned): ${item.name_en}`);
          failed++;
          continue;
        }

        const clean = translation.replace(/^["'「」『』""]|["'「」『』""]$/g, "").trim();
        console.log(`  ${item.name_en} → ${clean}`);

        if (!DRY_RUN) {
          try {
            if (lang === "ms") {
              await sql`UPDATE menu_items SET name_ms = ${clean}, updated_at = now() WHERE id = ${item.id}`;
            } else {
              await sql`UPDATE menu_items SET name_zh = ${clean}, updated_at = now() WHERE id = ${item.id}`;
            }
            translated++;
          } catch (e) {
            console.error(`  DB error for ${item.name_en}:`, e.message);
            failed++;
          }
        } else {
          translated++;
        }
      }

      // Brief pause to avoid rate limiting
      if (i + BATCH_SIZE < items.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`  Done: ${translated} translated, ${failed} failed`);
  }

  console.log("\n=== Complete ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
