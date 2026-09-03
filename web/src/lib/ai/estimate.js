import "server-only";
import { plausible } from "@/lib/nutrition/types";
import { searchAll, indian } from "@/lib/nutrition/search";
import { bestIngredient } from "@/lib/nutrition/match";
import { aiConfigured } from "./provider";
import { runRound } from "./run";

/**
 * Work out what a home-cooked dish contains.
 *
 * The manual-entry form asks for a nutrition panel, which is fine for a packet
 * and useless for your mother's sambar. There is no label to copy. So this
 * takes the name and a description of what went into it and estimates the
 * panel — but not the way you might expect, and the difference matters.
 *
 * The model is not asked "how many calories is sambar". It is asked to break
 * the dish into ingredients with weights, exactly as a recipe would; each
 * ingredient is then looked up in the real databases and the totals are added
 * up here, in code. So the answer is arithmetic over measured values rather
 * than a number recalled from training data.
 *
 * The result is still an estimate, because the recipe is a guess — but it is
 * an estimate you can see the working of, and every component is real.
 */

const TOOL = {
  name: "record_recipe",
  description: "Break the dish into its ingredients with cooked weights. Call this exactly once.",
  parameters: {
    type: "object",
    properties: {
      serves: {
        type: "number",
        description: "How many people the quantities below feed. Usually 1 to 6.",
      },
      finished_grams: {
        type: "number",
        description:
          "Weight of the finished dish as it reaches the table, across the whole batch, in grams. "
          + "For anything wet — dal, sambar, curry, soup, porridge — this is much larger than the "
          + "ingredients added up, because most of the weight is water. 300 g of dry dal becomes "
          + "roughly 2 kg of sambar. For a dry dish like a stir fry it is slightly less than the "
          + "ingredients, because water cooks off.",
      },
      ingredients: {
        type: "array",
        description:
          "Every ingredient with a meaningful calorie contribution. Include cooking oil and ghee — they are usually the largest single item and the easiest to forget.",
        items: {
          type: "object",
          properties: {
            search_query: {
              type: "string",
              description:
                "Plain generic name for a nutrition database: 'toor dal cooked', 'sunflower oil', "
                + "'onion raw'. Never a brand and never a shop product. Say which state it is in — "
                + "'cooked' or 'raw' — because the calories per 100 g differ by two or three times.",
            },
            grams: {
              type: "number",
              description:
                "Total cooked weight of this ingredient across the whole batch, in grams.",
            },
          },
          required: ["search_query", "grams"],
        },
      },
      note: {
        type: "string",
        description:
          "Anything that would change the numbers a lot and is worth telling the person.",
      },
    },
    required: ["ingredients", "serves", "finished_grams"],
  },
};

const SYSTEM = `You estimate the composition of home-cooked dishes for a nutrition tracker.

Break the dish into ingredients with realistic cooked weights for a normal
household batch. You do not know calorie values and must not state any — every
ingredient you name is looked up in a real nutrition database afterwards, and
the totals are computed from those. Your job is the recipe, not the numbers.

Rules:
- Use cooked, as-eaten weights. Rice roughly triples in weight when boiled;
  dal roughly doubles.
- Always include the cooking fat, with a real weight. It is usually the biggest
  single line and the one people leave out.
- Prefer plain generic ingredient names. A database has "toor dal, cooked"; it
  does not have "amma's special dal".
- If the description is too vague to estimate, still give the most ordinary
  version of that dish and say so in the note.`;

export async function estimate(dish, description) {
  const empty = {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fibre: 0,
    sugar: 0,
    satFat: 0,
    sodium: 0,
  };

  if (!aiConfigured()) {
    return {
      per100g: empty,
      ingredients: [],
      serves: 1,
      totalGrams: 0,
      error:
        "Estimating needs an AI key — ANTHROPIC_API_KEY, or GEMINI_API_KEY for " +
        "Google's free tier. Until then, enter the panel by hand.",
    };
  }

  let recipe;
  try {
    const res = await runRound({
      system: SYSTEM,
      history: [
        {
          role: "user",
          content: description?.trim()
            ? `Dish: ${dish}\nWhat is in it: ${description}`
            : `Dish: ${dish}`,
        },
      ],
      tools: [TOOL],
      forceTool: "record_recipe",
      maxTokens: 1200,
    });
    const call = res.calls.find((c) => c.name === "record_recipe");
    if (!call) throw new Error("no recipe returned");
    recipe = call.args;
  } catch (e) {
    console.error("[estimate] failed", e);
    return {
      per100g: empty,
      ingredients: [],
      serves: 1,
      totalGrams: 0,
      error: "Could not work that one out. Try describing what went into it.",
    };
  }

  const list = (recipe.ingredients ?? []).slice(0, 20);
  if (!list.length) {
    return {
      per100g: empty,
      ingredients: [],
      serves: 1,
      totalGrams: 0,
      error: "Could not break that into ingredients. Try naming what is in it.",
    };
  }

  // Every ingredient looked up for real, in parallel.
  const resolved = await Promise.all(
    list.map(async (item) => {
      const grams = Math.max(0, Math.min(Number(item.grams) || 0, 5000));
      /* The curated table is consulted directly as well as through the
         general search. searchAll ranks and then truncates, so a plain
         "Chicken breast, skinless, cooked" could be cut before the matcher
         ever saw it — which is how chicken curry came to be priced from
         cooked sausage, and onions from breaded onion rings in aioli. */
      const [wide, local] = await Promise.all([
        searchAll(item.search_query, 12).catch(() => []),
        Promise.resolve(indian.search(item.search_query, 6)).catch(() => []),
      ]);
      const food = bestIngredient(item.search_query, [...local, ...wide]);
      return { query: item.search_query, grams, food };
    }),
  );

  let totalGrams = 0;
  const totals = { ...empty };
  const ingredients = [];

  for (const r of resolved) {
    const f = r.food;
    const kcal = f ? (f.per100g.kcal * r.grams) / 100 : 0;
    ingredients.push({
      name: f?.name ?? r.query,
      grams: Math.round(r.grams),
      kcal: Math.round(kcal),
      matched: Boolean(f),
    });
    // Unmatched ingredients still add weight — leaving them out would
    // concentrate everything else and overstate the density.
    totalGrams += r.grams;
    if (!f) continue;
    const k = r.grams / 100;
    totals.kcal += f.per100g.kcal * k;
    totals.protein += f.per100g.protein * k;
    totals.carbs += f.per100g.carbs * k;
    totals.fat += f.per100g.fat * k;
    totals.fibre += f.per100g.fibre * k;
    totals.sugar += f.per100g.sugar * k;
    totals.satFat += f.per100g.satFat * k;
    totals.sodium += f.per100g.sodium * k;
  }

  if (totalGrams <= 0) {
    return {
      per100g: empty,
      ingredients,
      serves: recipe.serves ?? 1,
      totalGrams: 0,
      error: "None of those ingredients could be priced. Enter the panel by hand.",
    };
  }

  /* The denominator is the finished dish, not the shopping list.
     Summing raw ingredient weights and calling that the served weight is
     what put sambar at 281 kcal per 100 g — roughly three times reality —
     because the water it is mostly made of was never counted. The model's
     figure is trusted only inside a sane band around the ingredients;
     outside it, something has gone wrong and the sum is the safer answer. */
  const claimed = Number(recipe.finished_grams) || 0;
  const servedGrams =
    claimed >= totalGrams * 0.5 && claimed <= totalGrams * 6 ? claimed : totalGrams;

  const scale = 100 / servedGrams;
  const per100g = {
    kcal: round1(totals.kcal * scale),
    protein: round1(totals.protein * scale),
    carbs: round1(totals.carbs * scale),
    fat: round1(totals.fat * scale),
    fibre: round1(totals.fibre * scale),
    sugar: round1(totals.sugar * scale),
    satFat: round1(totals.satFat * scale),
    sodium: Math.round(totals.sodium * scale),
  };

  if (!plausible(per100g)) {
    return {
      per100g: empty,
      ingredients,
      serves: recipe.serves ?? 1,
      totalGrams: Math.round(totalGrams),
      error:
        "The numbers that came back did not add up, so they are not being offered. " +
        "Enter the panel by hand.",
    };
  }

  return {
    per100g,
    ingredients,
    serves: Math.max(1, Math.round(recipe.serves ?? 1)),
    totalGrams: Math.round(servedGrams),
    note: recipe.note,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;
