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
   request-per-minute cap, and the work is short.
 *
 * The version is pinned rather than tracking `gemini-flash-latest`, because a
 * silent model change would alter how photographs are read without anything
 * in this repository changing. `gemini-2.5-flash` was the original default and
 * Google has since closed it to new keys, which is exactly the kind of break
 * a pinned version makes visible instead of mysterious. Override with
 * GEMINI_MODEL. */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.7-flash";

/*
 * Models to fall back through when the first one is busy.
 *
 * Free-tier Gemini answers 503 "experiencing high demand" fairly often, and
 * the newest flash model is the most contended precisely because it is the
 * default everywhere. The SDK's own retries make this worse rather than
 * better: they sit on the same overloaded model for the best part of a
 * minute, so a photograph takes 51 seconds to fail.
 *
 * Stepping down a generation instead usually answers immediately, and for
 * naming the food on a plate the difference in quality is not detectable.
 * Ordered newest first; the configured model is always tried before these.
 */
const GEMINI_FALLBACKS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
];

/**
 * Which models are known to be busy, and until when.
 *
 * Falling back works, but on its own it pays the full timeout every single
 * time: a three-round conversation spent thirty seconds waiting on the same
 * overloaded model before stepping down, three times over, and took nearly
 * two minutes to answer something that needed twenty.
 *
 * So a model that reports itself overloaded is skipped for a couple of
 * minutes. Module-level and deliberately not persisted — it is a hint, it
 * costs nothing to be wrong about, and a fresh process should try the best
 * model again rather than inherit an old grudge.
 */
const busyUntil = new Map<string, number>();
const BUSY_FOR_MS = 120_000;

const isBusy = (model: string) => (busyUntil.get(model) ?? 0) > Date.now();
const markBusy = (model: string) => busyUntil.set(model, Date.now() + BUSY_FOR_MS);


/**
 * Is this a "the model is busy" failure, or a real one?
 *
 * 503 is the obvious case. 504 matters just as much and was missed at first:
 * an overloaded model does not always refuse, it sometimes simply never
 * answers, and the request dies on the deadline instead. That threw straight
 * out of the loop rather than falling back — so a busy model produced a hard
 * error for the person waiting, which is precisely what the fallback exists
 * to prevent.
 */
function isOverloaded(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  if (status === 503 || status === 504 || status === 429) return true;
  const text = String((e as Error)?.message ?? "");
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|high demand|overloaded|timed? ?out/i
    .test(text);
}

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
      return { text: "", calls: [], scratch: [] };
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

  /* Everything already said in this tool exchange, then the results that came
     back from the last round. Kept whole so the model can see what it has
     already looked up. */
  const scratch = [...((r.scratch ?? []) as Anthropic.MessageParam[])];
  if (r.toolResults?.length) {
    scratch.push({
      role: "user",
      content: r.toolResults.map((t) => ({
        type: "tool_result" as const, tool_use_id: t.id, content: t.result,
      })),
    });
  }
  messages.push(...scratch);

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

  scratch.push({ role: "assistant", content: res.content });
  return { text, calls, scratch };
}

/* ------------------------------------------------------------------ */
/* Gemini                                                              */
/* ------------------------------------------------------------------ */

async function geminiRound(r: Round & { image?: ImageInput }): Promise<RoundResult> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    /* Do not retry, and do not wait long.
     *
     * The SDK's default is five attempts with exponential backoff, which on a
     * 503 means sitting on an overloaded model for the better part of a
     * minute — and then this code falls back to a different one anyway, so a
     * photograph took 99 seconds to come back. Retrying a model that is out
     * of capacity only waits for it to still be out of capacity.
     *
     * One attempt, a hard ceiling, and the loop below moves to the next model
     * immediately. Falling back is the retry.
     *
     * 30 seconds rather than something tighter because a round that calls
     * tools genuinely takes longer than one that does not, and the fallback
     * list is short enough that the worst case stays inside a minute and a
     * half. */
    httpOptions: {
      timeout: 30_000,
      retryOptions: { attempts: 1 },
    },
  });

  const contents: Content[] = r.history.map((t, i) => {
    const parts: Part[] = [];
    if (i === 0 && r.image && t.role === "user") {
      parts.push({ inlineData: { mimeType: r.image.mediaType, data: r.image.base64 } });
    }
    parts.push({ text: t.content });
    // Gemini calls the assistant "model".
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });

  const scratch = [...((r.scratch ?? []) as Content[])];
  if (r.toolResults?.length) {
    scratch.push({
      role: "user",
      parts: r.toolResults.map((t) => ({
        functionResponse: { name: t.name, response: { result: t.result } },
      })),
    });
  }
  contents.push(...scratch);

  /* Try the configured model, then step down. Each attempt is a different
     model rather than the same one again, which is the point — retrying a
     model that is out of capacity just waits for it to still be out. */
  const request = {
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
  };

  const chain = [GEMINI_MODEL, ...GEMINI_FALLBACKS];
  /* Try the ones not known to be busy first, but keep the rest as a last
     resort — the cooldown is a guess, and being wrong about it should cost a
     slow answer rather than no answer. */
  const order = [...chain.filter((m) => !isBusy(m)), ...chain.filter(isBusy)];

  let res;
  let lastError: unknown;
  for (const model of order) {
    try {
      res = await ai.models.generateContent({ model, ...request });
      if (model !== GEMINI_MODEL) {
        console.warn(`[ai] answered with ${model} (${GEMINI_MODEL} is busy)`);
      }
      busyUntil.delete(model);
      break;
    } catch (e) {
      lastError = e;
      if (!isOverloaded(e)) throw e;
      markBusy(model);
    }
  }
  if (!res) {
    // Every model was busy. Say that, rather than something generic — it is
    // temporary, and the person should simply try again in a minute.
    const e = new Error(
      "Every Gemini model is busy at the moment. This usually clears in a "
      + "minute — try again.",
    ) as Error & { overloaded?: boolean };
    e.overloaded = true;
    e.cause = lastError;
    throw e;
  }

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

  const turn = res.candidates?.[0]?.content;
  if (turn) scratch.push(turn);
  return { text, calls, scratch };
}
