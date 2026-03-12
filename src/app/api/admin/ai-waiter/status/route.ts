import { statSync } from "fs";
import { join } from "path";
import { readChatSettings } from "@/lib/chat/settings";
import { getSystemPrompt } from "@/lib/chat/system-prompt";
import { cookies } from "next/headers";
import { verifyAdminToken, COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

const KNOWLEDGE_FILES = [
  { slug: "cafe-facts", name: "Cafe Facts" },
  { slug: "faq", name: "FAQ" },
  { slug: "menu-knowledge", name: "Menu Knowledge" },
];

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const isAdmin = token ? await verifyAdminToken(token) : false;
  if (!isAdmin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await readChatSettings();
  const systemPrompt = await getSystemPrompt();
  const systemPromptPreview = systemPrompt.slice(0, 600);

  const knowledgeFiles = KNOWLEDGE_FILES.map(({ slug, name }) => {
    const filePath = join(process.cwd(), "knowledge", `${slug}.md`);
    try {
      const stat = statSync(filePath);
      return {
        slug,
        name,
        sizeKb: Math.round((stat.size / 1024) * 10) / 10,
        lastModified: stat.mtime.toISOString(),
      };
    } catch {
      return { slug, name, sizeKb: 0, lastModified: new Date().toISOString() };
    }
  });

  return Response.json({
    model: settings.model,
    temperature: settings.temperature,
    systemPromptPrefixLength: settings.systemPromptPrefix?.length ?? 0,
    systemPromptPreview,
    knowledgeFiles,
    groqKeyPresent: !!process.env.GROQ_API_KEY,
    openrouterKeyPresent: !!process.env.OPENROUTER_API_KEY,
    rateLimitPerMin: 10,
    rateLimitPerDay: 100,
  });
}
