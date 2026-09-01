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

export function provider() {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

export const aiConfigured = () => provider() !== "none";

/** A tool, in the one shape both providers are adapted to. */

/**
 * One round of conversation, with optional tools.
 *
 * `history` is the plain text thread. `scratch` carries the tool call and its
 * result back in for the next round — the two providers represent that
 * differently, so it is kept opaque here and each adapter shapes it.
 */
