import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { FunctionCallingConfigMode, GoogleGenAI, type Content, type Part } from "@google/genai";
import { provider, type Round, type RoundResult, type ToolCall } from "./provider";

/**
 * One turn of a conversation, against whichever provider is configured.
 *
 * Both APIs do the same three things — a system instruction, a thread of
 * turns, and function calling — and they spell all three differently. This is
 * the thin layer that makes the rest of the app not care, so `identify`,
 * `coach` and `chat` are written once and run on either.
 *
 * The shapes that differ and had to be reconciled:
 *
 *   · Anthropic puts tool results in a `user` turn as `tool_result` blocks
 *     keyed by the id of the call. Gemini puts them in a `function` turn as
 *     `functionResponse` parts keyed by the function's *name*, with no id —
 *     so two concurrent calls to the same tool cannot be told apart, and the
 *     adapter has to keep them in order instead.
 *   · Anthropic returns the assistant's tool request as content blocks to
 *     echo back verbatim. Gemini returns parts. Either way the caller passes
 *     `raw` back in as `previous` and never looks inside it.
 */

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
/* Flash rather than Pro: this is a per-message cost on a free tier with a
   request-per-minute cap, and the work is short. */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export interface ImageInput {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export async function runRound(
  round: Round & { image?: ImageInput },
): Promise<RoundResult> {
  switch (provider()) {
    case "anthropic": return anthropicRound(round);
    case "gemini": return geminiRound(round);
    default:
      return { text: "", calls: [], raw: null };
  }
}

/* ------------------------------------------------------------------ */
/* Anthropic                                                           */
/* ------------------------------------------------------------------ */

async function anthropicRound(r: Round & { image?: ImageInput }): Promise<RoundResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const messages: Anthropic.MessageParam[] = r.history.map((t, i) => {
    // The image rides on the first user turn.
    if (i === 0 && r.image && t.role === "user") {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: r.image.mediaType, data: r.image.base64 } },
          { type: "text", text: t.content },
        ],
      };
    }
    return { role: t.role, content: t.content };
  });

  if (r.previous) {
    messages.push({ role: "assistant", content: r.previous as Anthropic.ContentBlockParam[] });
  }
  if (r.toolResults?.length) {
    messages.push({
      role: "user",
      content: r.toolResults.map((t) => ({
        type: "tool_result" as const, tool_use_id: t.id, content: t.result,
      })),
    });
  }

  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: r.maxTokens ?? 900,
    system: r.system,
    ...(r.tools?.length
      ? {
          tools: r.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters as Anthropic.Tool["input_schema"],
          })),
          ...(r.forceTool ? { tool_choice: { type: "tool" as const, name: r.forceTool } } : {}),
        }
      : {}),
    messages,
  });

  const calls: ToolCall[] = res.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({ id: b.id, name: b.name, args: b.input as Record<string, unknown> }));

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim();

  return { text, calls, raw: res.content };
}

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

async function geminiRound(r: Round & { image?: ImageInput }): Promise<RoundResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const contents: Content[] = r.history.map((t, i) => {
    const parts: Part[] = [];
    if (i === 0 && r.image && t.role === "user") {
      parts.push({ inlineData: { mimeType: r.image.mediaType, data: r.image.base64 } });
    }
    parts.push({ text: t.content });
    // Gemini calls the assistant "model".
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });

  if (r.previous) contents.push(r.previous as Content);

  if (r.toolResults?.length) {
    contents.push({
      role: "user",
      parts: r.toolResults.map((t) => ({
        functionResponse: { name: t.name, response: { result: t.result } },
      })),
    });
  }

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: r.system,
      maxOutputTokens: r.maxTokens ?? 900,
      ...(r.tools?.length
        ? {
            tools: [{
              functionDeclarations: r.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
              })),
            }],
            ...(r.forceTool
              ? {
                  toolConfig: {
                    functionCallingConfig: {
                      // ANY forces a call; AUTO would let it answer in prose,
                      // which the photo reader must never do.
                      mode: FunctionCallingConfigMode.ANY,
                      allowedFunctionNames: [r.forceTool],
                    },
                  },
                }
              : {}),
          }
        : {}),
    },
  });

  const parts = res.candidates?.[0]?.content?.parts ?? [];

  /* No ids in Gemini's function calls, so they are synthesised positionally.
     The adapter only has to round-trip them to itself, and it keeps ordering,
     so this is safe — it just cannot be compared across providers. */
  const calls: ToolCall[] = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({
      id: `g${i}`,
      name: p.functionCall!.name ?? "",
      args: (p.functionCall!.args ?? {}) as Record<string, unknown>,
    }));

  const text = parts.filter((p) => p.text).map((p) => p.text).join("").trim();

  return { text, calls, raw: res.candidates?.[0]?.content ?? null };
}
