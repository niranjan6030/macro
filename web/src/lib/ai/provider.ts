import "server-only";

/**
 * Which model answers.
 *
 * Two providers, chosen by which key is set. Google's free tier is real and
 * generous, and for a side project that matters more than the last few points
 * of quality — so if `GEMINI_API_KEY` is present and there is no Anthropic
 * key, everything here runs on Gemini at no cost.
 *
 * One thing worth knowing before choosing, because it is not obvious and it
 * matters for this app in particular: on Google's **free** tier your prompts
 * and responses may be used to improve their models. This app sends photos of
 * your meals and figures about your body. On the paid tier of either provider,
 * and on Anthropic's API generally, that does not happen. Progress photos are
 * never sent to any model either way — but the food photos are, and the coach
 * sees your weight and your diary.
 *
 * So: free is a legitimate choice, and it should be an informed one.
 */

export type Provider = "anthropic" | "gemini" | "none";

export function provider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

export const aiConfigured = (): boolean => provider() !== "none";

/** A tool, in the one shape both providers are adapted to. */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface Reply {
  text: string;
  calls: ToolCall[];
}

/**
 * One round of conversation, with optional tools.
 *
 * `history` is the plain text thread. `scratch` carries the tool call and its
 * result back in for the next round — the two providers represent that
 * differently, so it is kept opaque here and each adapter shapes it.
 */
export interface Round {
  system: string;
  history: Turn[];
  tools?: ToolSpec[];
  /** Force a tool, by name. Used by the photo reader, which must produce one. */
  forceTool?: string;
  maxTokens?: number;
  /** Results of the previous round's tool calls, keyed by call id. */
  toolResults?: { id: string; name: string; result: string }[];
  /**
   * Everything said since the last plain-text turn: the assistant turns that
   * asked for tools, and the results that came back.
   *
   * This carried only the *previous* round at first, which quietly broke
   * multi-step questions. Asked what is in two rotis and a katori of dal, the
   * model looked up the roti, then the dal — and by the third round the roti
   * result had fallen out of the conversation, so it asked for the dal again,
   * and again, until it ran out of rounds and gave up. It is opaque here
   * because each provider shapes these turns differently; pass back whatever
   * the last round returned.
   */
  scratch?: unknown[];
}

export interface RoundResult extends Reply {
  /** Pass back as `scratch` on the next round. */
  scratch: unknown[];
}
