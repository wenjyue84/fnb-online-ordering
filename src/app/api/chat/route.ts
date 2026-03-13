import { streamText, stepCountIs, type UIMessage, type LanguageModel, type ToolSet, tool, isTextUIPart } from "ai";
import { z } from "zod";
import { groq, openrouter } from "@/lib/chat/provider";
import { getSystemPrompt } from "@/lib/chat/system-prompt";
import { readChatSettings } from "@/lib/chat/settings";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import { headers, cookies } from "next/headers";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/auth";
import { checkOrderStatusHandler, submitOrderHandler } from "@/lib/tools/orders";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ChatRequestBody {
  messages: UIMessage[];
  sessionId?: string;
}

export async function POST(req: Request) {
  // Rate limiting
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";

  const rateCheck = await checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter || 60),
        },
      }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await req.json() as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }
  const { messages } = body;
  if (!messages) {
    return new Response(JSON.stringify({ error: "No messages" }), { status: 400 });
  }

  // Load admin-configurable settings on each request so changes apply immediately
  const settings = await readChatSettings();
  const primaryModel =
    settings.model === "openrouter"
      ? openrouter.chat("meta-llama/llama-3.3-70b-instruct")
      : groq.chat("llama-3.3-70b-versatile");
  const fallbackModel =
    settings.model === "openrouter"
      ? groq.chat("llama-3.3-70b-versatile")
      : openrouter.chat("meta-llama/llama-3.3-70b-instruct");

  // Truncate to last 10 messages — keeps context while limiting token usage (364-item menu is large)
  const truncated = messages.slice(-10);
  const systemPrompt = await getSystemPrompt();

  // Manually extract text from UIMessage parts — convertToModelMessages
  // crashes on manually-constructed assistant messages (no step metadata).
  const modelMessages = truncated
    .map((msg) => {
      const text = msg.parts
        ?.filter(isTextUIPart)
        .map((p) => p.text)
        .join("") ?? "";
      return { role: msg.role as "user" | "assistant" | "system", content: text };
    })
    .filter((m) => m.content.trim() !== "");

  // Admin detection — reads JWT cookie to set isAdmin flag (used for future admin-only tools)
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? "";
  const isAdmin = token ? await verifyAdminToken(token) : false;
  void isAdmin; // currently unused — framework for future admin-gated tools

  const addToTrayTool = tool({
    description:
      "Adds an item to the customer's tray/order builder. Call this whenever a customer says they want to order or add an item. You MUST provide the exact item ID, name, and price from the menu.",
    // @ts-expect-error - AI SDK type mismatch with zod
    parameters: z.object({
      id: z.string().describe("The item ID from the menu, e.g. BF01"),
      name: z.string().describe("The name of the item"),
      price: z.number().describe("The exact numeric price of the item in RM"),
    }),
  });

  const checkOrderStatusTool = tool({
    description: "Look up a pre-order status by numeric order ID.",
    parameters: z.object({
      orderId: z.string().describe("Numeric order ID, e.g. '42'"),
    }),
    execute: async ({ orderId }: { orderId: string }) => checkOrderStatusHandler(orderId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const submitOrderTool = tool({
    description: "Submit a pre-order. Only call after confirming items, phone number, and arrival time (min 15 min from now).",
    parameters: z.object({
      items: z
        .array(
          z.object({
            id: z.string().describe("Menu item code"),
            name: z.string().describe("Item name"),
            price: z.number().positive().describe("Price in RM"),
            quantity: z.number().int().positive(),
          })
        )
        .min(1),
      contactNumber: z.string().describe("Malaysian phone number"),
      estimatedArrival: z.string().describe("ISO 8601 arrival datetime"),
    }),
    execute: async ({
      items,
      contactNumber,
      estimatedArrival,
    }: {
      items: { id: string; name: string; price: number; quantity: number }[];
      contactNumber: string;
      estimatedArrival: string;
    }) => submitOrderHandler({ items, contactNumber, estimatedArrival }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const toolSet = { addToTray: addToTrayTool, checkOrderStatus: checkOrderStatusTool, submitOrder: submitOrderTool } as ToolSet;

  function buildStream(model: LanguageModel): Response {
    return streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      temperature: settings.temperature,
      stopWhen: stepCountIs(3),
      tools: toolSet,
    }).toUIMessageStreamResponse();
  }

  // streamText errors come back as {type:"error"} SSE events (e.g. Groq TPM/TPD limits).
  // We intercept the stream and transparently fall back to the other provider on error.
  // The server emits ONE authoritative start event, then strips start from both model streams
  // so the client never sees a duplicate start event regardless of which model responds.
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Pipe a model stream to the writer, stripping the top-level start event (already emitted).
  // Returns true if an error event was encountered (signals: try fallback).
  // Parses at the SSE-event level (split on \n\n) so a chunk containing both
  // {"type":"start"} and {"type":"start-step"} only drops the start event,
  // not the entire chunk — fixing DefaultChatTransport getting stuck in loading.
  async function pipeStream(response: Response): Promise<boolean> {
    const reader = response.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) return false;
        buf += dec.decode(value, { stream: true });
        // Split on SSE event delimiter; keep any incomplete trailing event in buf
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.trim()) continue;
          if (part.includes('"type":"error"')) {
            console.warn("[chat] Stream error — switching to fallback");
            return true;
          }
          // Strip the model's own start event (server already emitted one)
          if (part.includes('"type":"start"') && !part.includes('"type":"start-step"')) {
            continue;
          }
          await writer.write(encoder.encode(part + "\n\n"));
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  (async () => {
    // Emit a single authoritative start event before any model stream begins
    await writer.write(encoder.encode('data: {"type":"start"}\n\n'));

    let hadError = false;
    try {
      hadError = await pipeStream(buildStream(primaryModel));
    } catch (err) {
      hadError = true;
      console.warn("[chat] Primary stream threw:", err);
    }

    if (hadError) {
      try {
        await pipeStream(buildStream(fallbackModel));
      } catch (err) {
        console.error("[chat] Fallback also failed:", err);
        await writer.write(encoder.encode('data: {"type":"error","errorText":"AI service temporarily unavailable"}\n\ndata: [DONE]\n\n'));
      }
    }

    await writer.close();
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
