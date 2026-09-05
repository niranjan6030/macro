import "server-only";
import { forGrams } from "@/lib/nutrition/types";
import { MEASURES } from "@/lib/nutrition/portions";
import { searchAll } from "@/lib/nutrition/search";
import { bestIngredient } from "@/lib/nutrition/match";
import { aiConfigured } from "./provider";
import { runRound } from "./run";

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

const MAX_IMAGE_BYTES = 5_000_000;

export const visionConfigured = aiConfigured;

const TOOL = {
  name: "record_foods",
  description: "Record every distinct food visible in the photograph. Call this exactly once.",
  parameters: {
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
                "Two to four words to look this up in a nutrition database. Use the plain, " +
                "generic name of the food and its cooking method, no brand or adjectives: " +
                "'chicken breast grilled', 'white rice cooked', 'toor dal'.",
            },
            brand: {
              type: "string",
              description: "Brand name, only if it is legible on packaging in the photo.",
            },
            barcode: {
              type: "string",
              description: "The barcode digits, only if clearly readable in the photo.",
            },
            /* Asked as a household measure and a count, because that is a
               judgement a model can actually make from a photograph. "How
               many grams of dal is that" is a question nobody can answer by
               looking, and asking it produced confident numbers that were
               wrong. "Is that about one katori or two" is answerable, and
               the grams follow from a table rather than from a guess. */
            portion_measure: {
              type: "string",
              enum: [
                "katori_small", "katori", "bowl", "plate", "ladle",
                "tumbler", "glass", "glass_large", "cup",
                "piece", "small_piece", "biscuit", "slice_bread", "slice_cheese",
                "slice_cake", "slice_pizza", "square", "bar", "egg", "fruit",
                "scoop", "palm", "handful", "tbsp", "tsp", "g100",
              ],
              description:
                "Which household measure this portion is best described in. Use the one a " +
                "person would say out loud: a katori of dal, two rotis, a palm of chicken, " +
                "a glass of milk. Use g100 only for a packaged item whose weight is printed.",
            },
            portion_count: {
              type: "number",
              description:
                "How many of that measure. Halves are fine — 1.5 katori, 2 rotis, 0.5 palm. " +
                "Use visible references for scale: a dinner plate is about 27 cm across, a " +
                "katori about 11 cm, a teaspoon 5 ml. Judge the food only, never the vessel.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description:
                "How certain you are of the identification. Use 'low' when the dish is " +
                "obscured, ambiguous, or could be one of several similar things.",
            },
            note: {
              type: "string",
              description:
                "Anything affecting the numbers that the name alone would miss: 'deep " +
                "fried', 'visible ghee', 'sauce on the side'. Omit if there is nothing.",
            },
          },
          required: ["label", "search_query", "portion_measure", "portion_count", "confidence"],
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
- Describe the portion the way a person would say it out loud, not in grams:
  a katori of dal, one and a half katori of rice, two rotis, a palm of
  chicken, a glass of milk, three biscuits. Pick the measure that fits the
  food and say how many. Halves are fine.
- Judge the food, never the vessel. A katori is about 11 cm across and a
  dinner plate about 27 cm — use them for scale, not as the thing measured.
- Do not convert to grams yourself. The weight of each measure is looked up
  afterwards, against this specific food, and your arithmetic would only
  overwrite a figure somebody actually weighed.
- Use "low" confidence freely. An honest "low" lets the person correct it; a
  confident wrong answer does not.
- If packaging is visible and legible, report the brand and any barcode. That
  gets an exact label match rather than a generic one.
- If there is no food in the image, set not_food and return an empty list.`;

export async function identify(dataUrl) {
  if (!aiConfigured()) {
    return { items: [], notFood: false, message: "Photo recognition is not configured." };
  }

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    return { items: [], notFood: false, message: "That image could not be read." };
  }

  let raw;
  try {
    const res = await runRound({
      system: SYSTEM,
      history: [{ role: "user", content: "Identify every food in this photograph." }],
      image: { mediaType: parsed.mediaType, base64: parsed.base64 },
      tools: [TOOL],
      // The model must produce a structured record, never prose about the meal.
      forceTool: "record_foods",
      maxTokens: 1500,
    });

    const call = res.calls.find((c) => c.name === "record_foods");
    if (!call) {
      return { items: [], notFood: false, message: "Could not read that photo. Try again." };
    }
    raw = call.args;
  } catch (e) {
    console.error("[identify] vision call failed", e);
    // A busy model is temporary and worth saying so; anything else is not.
    const busy = e?.overloaded;
    return {
      items: [],
      notFood: false,
      message: busy
        ? "The photo reader is busy right now. Try again in a minute, or search for the food by name."
        : "Photo recognition is unavailable right now.",
    };
  }

  if (raw.not_food || !raw.items?.length) {
    return { items: [], notFood: true, message: "No food found in that photo." };
  }

  // Database lookups are independent and cheap, so they go together.
  const looked = await Promise.all(
    raw.items.slice(0, 8).map(async (item) => ({ item, food: await lookup(item) })),
  );

  /* Anything nothing matched gets costed from its recipe instead — but that
     is a whole extra model call each, so it runs one at a time and stops
     after three. Concurrently with a shared counter would not work: every
     item would read the budget before any of them had spent it, and a plate
     of six unknowns would fire six calls. */
  let budget = 3;
  for (const row of looked) {
    if (row.food || budget <= 0) continue;
    budget -= 1;
    row.food = await costFromRecipe(row.item);
  }

  const items = looked.map(({ item, food }) => {
    /* The measure the model chose, priced against this specific food where
       the curated table weighed it — a roti is 40 g, not the generic 50 g a
       "piece" would otherwise assume. */
    const portion = resolvePortion(item, food);

    return {
      label: item.label,
      grams: portion.grams,
      // Carried so the card can say "about 2 rotis" rather than "about 80 g",
      // and so the person corrects a count they can see rather than a weight
      // they would have to imagine.
      portion: { measure: portion.label, count: portion.count },
      confidence: item.confidence ?? "low",
      food,
      nutrients: food ? forGrams(food.per100g, portion.grams) : null,
      note: item.note,
    };
  });

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
async function lookup(item) {
  if (item.barcode) {
    const { off } = await import("@/lib/nutrition/search");
    const exact = await off.byBarcode(item.barcode).catch(() => null);
    if (exact) return exact;
  }

  const queries = item.brand
    ? [`${item.brand} ${item.search_query}`, item.search_query]
    : [item.search_query];

  for (const q of queries) {
    const hits = await searchAll(q, 10).catch(() => []);
    // Not hits[0]: the general ranking puts confidence above closeness, which
    // is right for browsing and wrong here. Same reasoning as the recipe
    // estimator, and the same bug — "drumstick" answered with a boiled sweet.
    const best = bestIngredient(q, hits);
    if (best) return best;
  }
  return null;
}

/**
 * Nothing in any database matched, so work it out from the recipe instead.
 *
 * This used to give up and say "add it by hand", which is a strange answer
 * from an app that has just told you what is on your plate. Amma's sambar
 * is not in Open Food Facts and never will be; refusing to cost it means the
 * one meal most worth logging is the one you cannot log.
 *
 * The numbers still come from the database — the dish is broken into
 * ingredients and each one is priced — so this is a longer route to a real
 * figure rather than a licence for the model to invent one. It is marked as
 * an estimate, because the recipe is a guess even when the arithmetic is not.
 */
async function costFromRecipe(item) {
  const { estimate } = await import("./estimate");
  const guess = await estimate(item.label, item.note ?? "").catch(() => null);
  if (!guess || guess.error || !(guess.per100g?.kcal > 0)) return null;

  return {
    id: `estimate:${item.search_query}`,
    name: item.label,
    brand: null,
    source: "estimate",
    confidence: "estimated",
    per100g: guess.per100g,
    servingG: null,
    servingLabel: null,
    ingredients: guess.ingredients,
  };
}

/** Portion estimates outside this range are not estimates, they are errors. */
/**
 * Turn "about one and a half katori" into grams.
 *
 * The model picks a measure and a count; the weight of that measure comes
 * from the household table, or from the food's own weighed serving when the
 * curated entry has one. That is the whole reason for asking this way — the
 * judgement stays with the model and the arithmetic stays here.
 */
function resolvePortion(item, food) {
  const count = sane(item.portion_count, 1, 0.25, 20);
  const id = typeof item.portion_measure === "string" ? item.portion_measure : "";

  // A food that was actually weighed beats a generic measure of the same kind.
  const countable = ["piece", "small_piece", "biscuit", "egg", "fruit", "slice_bread"];
  if (food?.servingG > 0 && countable.includes(id)) {
    return {
      grams: clampGrams(food.servingG * count),
      label: (food.servingLabel ?? "serving").replace(/^1\s+/, ""),
      count,
    };
  }

  const measure = MEASURES[id];
  if (!measure) return { grams: clampGrams(100 * count), label: "portion", count };
  return { grams: clampGrams(measure.grams * count), label: measure.label, count };
}

const clampGrams = (n) => Math.round(Math.min(Math.max(n, 1), 2000));

function sane(v, fallback, lo, hi) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, lo), hi);
}

function parseDataUrl(url) {
  const m = /^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i.exec(url);
  if (!m) return null;
  const base64 = m[3];
  // base64 is 4 characters per 3 bytes.
  if ((base64.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  const type = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  return { mediaType: type, base64 };
}
