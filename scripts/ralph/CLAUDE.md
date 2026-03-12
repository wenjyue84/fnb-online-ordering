# Ralph Iteration Prompt — fnb-online-ordering (Iteration 4: AI Waiter Enhancement)

## Context

You are implementing user stories for the **fnb-online-ordering** project — a Next.js 16 F&B online ordering platform with an AI waiter chatbot.

**This iteration enhances the AI waiter** by connecting it to **Rainbow AI** (a separate project) and adding customer-facing UX improvements.

## Two Projects

This iteration involves TWO codebases:

| Project | Path | Tech Stack |
|---------|------|-----------|
| fnb-online-ordering | Current directory (`.`) | Next.js 16, React 19, TypeScript, Tailwind CSS v4, Vercel AI SDK |
| rainbow-ai | `C:\Users\Jyue\Documents\1-projects\Software Projects\rainbow-ai` | Node.js, Express, TypeScript, esbuild, Baileys |

**You may edit files in BOTH projects.** Rainbow AI stories edit files at the rainbow-ai path above.

## Key Architecture

### AI Waiter (fnb-online-ordering)
- Chat endpoint: `src/app/api/chat/route.ts` — streaming via Vercel AI SDK
- System prompt: `src/lib/chat/system-prompt.ts` — builds prompt from knowledge/ files + DB menu
- Chat settings: `src/lib/chat/settings.ts` — DB-backed admin config
- Rate limiting: `src/lib/chat/rate-limit.ts` — per-IP dual-window
- Chat UI: `src/components/chat/` — chat-bubble, chat-panel, chat-widget
- Tools: `src/lib/tools/orders.ts` — addToTray, checkOrderStatus, submitOrder
- Knowledge files: `knowledge/cafe-facts.md`, `knowledge/faq.md`, `knowledge/menu-knowledge.md`
- AI providers: Groq (llama-3.3-70b) primary, OpenRouter fallback

### Rainbow AI (separate project)
- Chat engine: `src/assistant/chat-engine.ts` — processChat() function
- Webchat API: `src/routes/public/webchat-api.ts` — POST /api/chat/:profileId/message
- Profile registry: `src/assistant/profile-registry.ts` — multi-profile support
- Knowledge base: `src/assistant/knowledge-base-instance.ts` — per-profile KB with hot-reload
- Config store: `src/assistant/config-store.ts` — JSON + Postgres dual-write
- Makan profile: `profiles.json` (id: "makan-moments"), `.rainbow-kb-makan/`, `src/assistant/data-makan/`
- AI providers: Multi-provider fallback chain (Gemini, Groq, Ollama, OpenRouter)
- Deploy: AWS Lightsail at `/var/www/rainbow-ai`

## Dev Commands

```bash
# fnb-online-ordering (current directory)
npm run dev       # Dev server on http://localhost:3031
npm run build     # Production build (quality gate)
npm run lint      # ESLint (quality gate)

# rainbow-ai (separate directory)
cd "C:\Users\Jyue\Documents\1-projects\Software Projects\rainbow-ai"
npm run build     # esbuild bundle
npm run check     # TypeScript check (tsc --noEmit)
```

## Quality Gates

After implementing each story:
1. Run `npm run build` in fnb-online-ordering — must pass with zero errors
2. Run `npm run lint` in fnb-online-ordering — no new warnings
3. If the story edits rainbow-ai TypeScript files, also verify the edits are syntactically valid
4. Read progress.txt before starting — it contains learnings from previous iterations

## Rules

1. **Read before editing** — always read a file before modifying it
2. **3 languages** — any new user-facing text needs translations in all 3 `messages/` files (en, ms, zh) — EXCEPT quick-reply buttons which are English-only
3. **Mobile-first** — touch targets ≥ 44px, no horizontal scroll at 390px
4. **Prices in RM** — Malaysian Ringgit
5. **No pork, no lard, Halal-friendly** — preserve dietary info
6. **shadcn/ui** for UI primitives — use existing components in src/components/ui/
7. **Lucide React** for icons — already installed
8. **Neon Postgres** — use `sql` from `@/lib/db` for DB queries
9. **FeedMe POS has NO API** — never attempt direct POS integration
10. **Admin auth** — all /api/admin/ routes require verifyAdminToken()
