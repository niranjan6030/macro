import { withUser, ok, fail, body, str } from "@/lib/api";
import { identify, visionConfigured } from "@/lib/ai/identify";

/**
 * A photo of a meal, broken into its parts with a weight for each.
 *
 * Nothing is written to the diary here. The response is a proposal — the
 * person confirms or corrects each weight, and only then does it get logged
 * through /api/diary. Auto-logging a photo would bake the model's portion
 * guess into their history as if it were a measurement.
 */
export const POST = withUser(async (_uid, req) => {
  if (!visionConfigured) {
    return fail(
      "Photo recognition is not switched on. Set ANTHROPIC_API_KEY, or search for the food by name.",
      503,
    );
  }

  const image = str((await body(req)).image, 8_000_000);
  if (!image?.startsWith("data:image/")) return fail("Take or choose a photo first.");

  const result = await identify(image);
  if (result.message && !result.items.length) {
    return ok({ ...result, items: [] });
  }
  return ok(result);
});
