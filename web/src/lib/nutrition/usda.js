import { plausible } from "./types";

/**
 * USDA FoodData Central — whole and minimally processed food.
 *
 * This is the source for "150 g chicken breast" or "1 medium banana": the
 * Foundation and SR Legacy datasets are laboratory analyses, which is as
 * close to ground truth as nutrition data gets. Branded entries exist here
 * too but duplicate Open Food Facts with worse coverage outside the US, so
 * they are excluded.
 *
 * Needs a free key from https://fdc.nal.usda.gov/api-key-signup.html.
 * Without one this returns nothing and the caller falls back to OFF.
 */

const KEY = process.env.USDA_API_KEY;
const TIMEOUT_MS = 6_000;

export const usdaConfigured = Boolean(KEY);

/** FoodData Central nutrient numbers. Stable; these are the canonical IDs. */
const N = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fibre: 1079,
  sugar: 2000,
  satFat: 1258,
  sodium: 1093,
};

/* Laboratory-analysed first, then the survey averages. Branded is left out
   deliberately — see the note above. */
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

export async function search(query, limit = 15) {
  if (!KEY) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${KEY}` +
    `&query=${encodeURIComponent(q)}` +
    `&pageSize=${limit}` +
    DATA_TYPES.map((t) => `&dataType=${encodeURIComponent(t)}`).join("");

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 604_800 }, // lab values do not change week to week
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const json = await res.json();
    const foods = json?.foods ?? [];
    return foods.map((f) => toFood(f)).filter((f) => f !== null);
  } catch {
    return [];
  }
}

export async function byId(fdcId) {
  if (!KEY) return null;
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/food/${encodeURIComponent(fdcId)}?api_key=${KEY}`,
      { next: { revalidate: 604_800 } },
    );
    if (!res.ok) return null;
    return toFood(await res.json());
  } catch {
    return null;
  }
}

function toFood(f) {
  const name = str(f.description);
  if (!name) return null;

  const values = new Map();
  const list = f.foodNutrients ?? [];
  for (const item of list) {
    // The search endpoint and the detail endpoint nest this differently.
    const id = Number(item.nutrientId ?? item.nutrient?.id ?? NaN);
    const value = Number(item.value ?? item.amount ?? NaN);
    if (Number.isFinite(id) && Number.isFinite(value)) values.set(id, value);
  }

  // FoodData Central reports everything per 100 g already.
  const per100g = {
    kcal: values.get(N.kcal) ?? 0,
    protein: values.get(N.protein) ?? 0,
    carbs: values.get(N.carbs) ?? 0,
    fat: values.get(N.fat) ?? 0,
    fibre: values.get(N.fibre) ?? 0,
    sugar: values.get(N.sugar) ?? 0,
    satFat: values.get(N.satFat) ?? 0,
    sodium: Math.round(values.get(N.sodium) ?? 0),
  };

  if (per100g.kcal === 0 && per100g.protein === 0 && per100g.fat === 0) return null;
  if (!plausible(per100g)) return null;

  return {
    id: String(f.fdcId ?? name),
    source: "usda",
    // USDA descriptions are shouty and comma-heavy: "CHICKEN, BROILERS, BREAST".
    name: tidy(name),
    brand: null,
    per100g,
    servingG: null,
    servingLabel: null,
    confidence: str(f.dataType) === "Survey (FNDDS)" ? "estimated" : "measured",
  };
}

function tidy(s) {
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const text = parts.length > 3 ? parts.slice(0, 3).join(", ") : parts.join(", ");
  return text.replace(/\b[A-Z]{2,}\b/g, (w) => w[0] + w.slice(1).toLowerCase());
}

const str = (v) => (typeof v === "string" ? v.trim() : "");
