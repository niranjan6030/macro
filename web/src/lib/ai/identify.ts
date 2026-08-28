import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { type Food, forGrams } from "@/lib/nutrition/types";
import { searchAll } from "@/lib/nutrition/search";

/**
 * Read a photograph of a meal.
 *
 * The division of labour here is the whole point of the feature, and it is
 * deliberate: the model is asked *what the food is and how much of it there
 * is*, and it is never asked how many calories that is. Vision models will
 * answer the calorie question — fluently, confidently, and wrongly. The
 * screenshot that prompted this app is a good example: a packet's protein
 * and fibre came back as the same number, which is not a reading, it is a
 * guess dressed as one.
 *
 * So: the model identifies and estimates weight, the nutrition databases
 * supply the composition, and the arithmetic happens here. Every returned
 * item says which of those produced it.
 *
 * Portion estimation from a photo is genuinely hard and stays approximate —
 * the response carries a confidence for each item and the UI asks the user
 * to confirm the grams before anything is logged.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const MAX_IMAGE_BYTES = 5_000_000;

export const visionConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

export interface IdentifiedItem {
  /** What to show: "Chicken biryani". */
  label: string;
  /** The model's portion estimate, grams. The user confirms it. */
  grams: number;
  /** How sure the model is that it named the food correctly. */
  confidence: "high" | "medium" | "low";
  /** The matched database entry, when one was found. */
  food: Food | null;
  /** Nutrition for `grams`, or null when no database entry matched. */
  nutrients: ReturnType<typeof forGrams> | null;
  /** Set when the model saw something worth flagging: "fried, visible oil". */
  note?: string;
}

export interface IdentifyResult {
  items: IdentifiedItem[];
  /** True when the photo did not contain food. */
  notFood: boolean;
  message?: string;
}

const TOOL: Anthropic.Tool = {
  name: "record_foods",
  description:
    "Record every distinct food visible in the photograph. Call this exactly once.",
  input_schema: {
    type: "object",
    properties: {
      not_food: {
        type: "boolean",
        description: "True if the image contains no food at all.",
      },
      items: {
        type: "array",
        description: "One entry per distinct food. Split a plate into its components.",
        items: {
          type: "object",
          properties: {
            label: {
              type: "string",
              description: "What a person would call this, e.g. 'Chicken biryani'.",
            },
            search_query: {
              type: "string",
              description:
                "Two to four words to look this up in a nutrition database. Use the plain, "
                + "generic name of the food and its cooking method, no brand or adjectives: "
                + "'chicken breast grilled', 'white rice cooked', 'toor dal'.",
            },
            brand: {
              type: "string",
              description: "Brand name, only if it is legible on packaging in the photo.",
            },
            barcode: {
              type: "string",
              description: "The barcode digits, only if clearly readable in the photo.",
            },
            estimated_grams: {
              type: "number",
              description:
                "Edible weight as served, in grams. Use visible references for scale — a "
                + "dinner plate is about 27 cm, a teaspoon 5 ml, a standard katori 150 ml. "
                + "Estimate the food only, never the plate or bowl.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description:
                "How certain you are of the identification. Use 'low' when the dish is "
                + "obscured, ambiguous, or could be one of several similar things.",
            },
            note: {
              type: "string",
              description:
                "Anything affecting the numbers that the name alone would miss: 'deep "
                + "fried', 'visible ghee', 'sauce on the side'. Omit if there is nothing.",
            },
          },
          required: ["label", "search_query", "estimated_grams", "confidence"],
        },
      },
    },
    required: ["items", "not_food"],
  },
};

const SYSTEM = `You identify food in photographs for a nutrition tracking app.

Your job is identification and portion estimation only. You must never state
calorie or macronutrient values — those are looked up from a nutrition
database using the names you provide. Providing your own numbers would
corrupt the result.

Rules:
- Break a composite plate into its separate components. Rice, dal and a roti
  on one thali are three entries, not one.
- Estimate the edible weight as served. A typical restaurant portion of rice
  is 200-250 g; one roti is 35-45 g; a katori of dal is about 150 g.
- Use "low" confidence freely. An honest "low" lets the person correct it; a
  confident wrong answer does not.
- If packaging is visible and legible, report the brand and any barcode. That
  gets an exact label match rather than a generic one.
- If there is no food in the image, set not_food and return an empty list.`;

export async function identify(dataUrl: string): Promise<IdentifyResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return { items: [], notFood: false, message: "Photo recognition is not configured." };
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { items: [], notFood: false, message: "That image could not be read." };
  }

  const client = new Anthropic({ apiKey: key });

  let raw: RawResult;
  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "record_foods" },
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: parsed.mediaType, data: parsed.base64 },
          },
          { type: "text", text: "Identify every food in this photograph." },
        ],
      }],
    });

    const block = res.content.find((c) => c.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return { items: [], notFood: false, message: "Could not read that photo. Try again." };
    }
    raw = block.input as RawResult;
  } catch (e) {
    console.error("[identify] vision call failed", e);
    return { items: [], notFood: false, message: "Photo recognition is unavailable right now." };
  }

  if (raw.not_food || !raw.items?.length) {
    return { items: [], notFood: true, message: "No food found in that photo." };
  }

  // Look each one up for real. These are independent, so they go together.
  const items = await Promise.all(
    raw.items.slice(0, 8).map(async (item): Promise<IdentifiedItem> => {
      const grams = sane(item.estimated_grams);
      const food = await lookup(item);
      return {
        label: item.label,
        grams,
        confidence: item.confidence ?? "low",
        food,
        nutrients: food ? forGrams(food.per100g, grams) : null,
        note: item.note,
      };
    }),
  );

  return { items, notFood: false };
}

/**
 * Find the database entry for one identified item.
 *
 * A legible barcode is worth more than any search: it is the exact product,
 * with the manufacturer's own declared panel. Otherwise fall back to the
 * text search, preferring a brand-qualified query when a brand was read off
 * the packaging.
 */
async function lookup(item: RawItem): Promise<Food | null> {
  if (item.barcode) {
    const { off } = await import("@/lib/nutrition/search");
    const exact = await off.byBarcode(item.barcode).catch(() => null);
    if (exact) return exact;
  }

  const queries = item.brand
    ? [`${item.brand} ${item.search_query}`, item.search_query]
    : [item.search_query];

  for (const q of queries) {
    const hits = await searchAll(q, 3).catch(() => []);
    if (hits.length) return hits[0];
  }
  return null;
}

/** Portion estimates outside this range are not estimates, they are errors. */
function sane(g: unknown): number {
  const n = typeof g === "number" ? g : Number(g);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.round(Math.min(Math.max(n, 1), 2000));
}

function parseDataUrl(url: string): { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string } | null {
  const m = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(url);
  if (!m) return null;
  const base64 = m[3];
  // base64 is 4 characters per 3 bytes.
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  const type = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  return { mediaType: type as "image/jpeg" | "image/png" | "image/webp", base64 };
}

interface RawItem {
  label: string;
  search_query: string;
  brand?: string;
  barcode?: string;
  estimated_grams: number;
  confidence?: "high" | "medium" | "low";
  note?: string;
}
interface RawResult {
  items: RawItem[];
  not_food?: boolean;
}
