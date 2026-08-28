import { type Food, type Nutrients, plausible } from "./types";

/**
 * Open Food Facts — packaged and branded food, by barcode or by name.
 *
 * This is the right source for anything with a wrapper: the numbers are
 * transcribed from the manufacturer's declared panel, which is the same panel
 * the user is holding. Coverage of Indian brands is good, which is why it is
 * tried before USDA for packaged goods.
 *
 * Two different endpoints, because Open Food Facts has two:
 *
 *   · Barcode goes to the v2 product API, which is exact and cheap.
 *   · Text search goes to search.openfoodfacts.org, their current search
 *     service. The older `cgi/search.pl` is what most integrations still
 *     call and it now answers 503 under any real load — worth knowing,
 *     because the failure looks like "no results" rather than an error.
 *
 * No API key. Their terms ask for an identifying User-Agent, which is what
 * keeps this from being rate-limited as anonymous traffic.
 *
 * It is crowd-sourced, so every result goes through `plausible()` before it
 * is offered to anyone.
 */

const UA = "Macro/0.1 (https://github.com/macro-app; nutrition tracker)";
const TIMEOUT_MS = 7_000;

/** Fields we actually read. Asking for fewer makes the response much smaller. */
const FIELDS = [
  "code", "product_name", "product_name_en", "brands", "quantity",
  "serving_size", "serving_quantity", "nutriments", "nutrition_data_per",
].join(",");

export async function byBarcode(code: string): Promise<Food | null> {
  const clean = code.replace(/\D/g, "");
  if (clean.length < 8 || clean.length > 14) return null;

  const json = await get<{ status?: number; product?: Record<string, unknown> }>(
    `https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=${FIELDS}`,
  );
  if (!json || json.status === 0 || !json.product) return null;
  return toFood(json.product);
}

export async function search(query: string, limit = 15): Promise<Food[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const json = await get<{ hits?: unknown[] }>(
    `https://search.openfoodfacts.org/search` +
    `?q=${encodeURIComponent(q)}&page_size=${Math.min(limit, 50)}`,
  );

  return (json?.hits ?? [])
    .map((h) => toFood(h as Record<string, unknown>))
    .filter((f): f is Food => f !== null);
}

async function get<T>(url: string): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      // Panels do not change often and the same searches repeat constantly.
      // This is also what keeps us inside their rate limits.
      next: { revalidate: 86_400 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;          // 503 under load is normal here
    return (await res.json()) as T;
  } catch {
    // Offline, timed out, or Open Food Facts is down. The caller falls
    // through to the other sources rather than failing the whole search.
    return null;
  }
}

function toFood(p: Record<string, unknown>): Food | null {
  const n = (p.nutriments ?? {}) as Record<string, number | string>;
  const name = str(p.product_name_en) || str(p.product_name);
  if (!name) return null;

  /* Entries with no panel at all are common in the search index: someone
     photographed the packet but nobody has typed the numbers in yet. Those
     arrive as an empty `nutriments` object, which would read as a food with
     zero calories — so a bag of crisps could be logged as free. The test is
     for the *presence* of the fields, not their value, because a genuine
     zero (black coffee, sparkling water) must still be allowed through. */
  if (!hasPanel(n)) return null;

  const per100g: Nutrients = {
    kcal: kcal(n),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    fibre: num(n.fiber_100g),
    sugar: num(n.sugars_100g),
    satFat: num(n["saturated-fat_100g"]),
    // Open Food Facts reports sodium in grams; panels are read in milligrams.
    sodium: Math.round(num(n.sodium_100g) * 1000),
  };

  if (!plausible(per100g)) return null;

  return {
    id: str(p.code) || `off:${name}`,
    source: "openfoodfacts",
    name,
    brand: brand(p.brands),
    per100g,
    servingG: servingGrams(p),
    servingLabel: str(p.serving_size) || null,
    barcode: str(p.code) || null,
    confidence: "label",
  };
}

/**
 * Does this entry actually carry a nutrition panel?
 *
 * Energy alone is not enough of a test — a few entries record only the
 * macros — so any one of the core fields being present counts.
 */
function hasPanel(n: Record<string, number | string>): boolean {
  const keys = [
    "energy-kcal_100g", "energy-kj_100g", "energy_100g",
    "proteins_100g", "carbohydrates_100g", "fat_100g",
  ];
  return keys.some((k) => n[k] !== undefined && n[k] !== null && n[k] !== "");
}

/** The two endpoints disagree: v2 sends "Brand A,Brand B", search sends an array. */
function brand(raw: unknown): string | null {
  if (Array.isArray(raw)) return str(raw[0]) || null;
  return str(raw).split(",")[0]?.trim() || null;
}

/** Some regions store kJ and some store kcal. */
function kcal(n: Record<string, number | string>): number {
  const direct = num(n["energy-kcal_100g"]);
  if (direct > 0) return direct;
  const kj = num(n["energy-kj_100g"]) || num(n.energy_100g);
  return kj > 0 ? Math.round(kj / 4.184) : 0;
}

function servingGrams(p: Record<string, unknown>): number | null {
  const q = num(p.serving_quantity);
  if (q > 0) return q;
  // "30 g", "2 biscuits (25g)" — take the first weight in the string.
  const m = str(p.serving_size).match(/([\d.]+)\s*g/i);
  return m ? Number(m[1]) : null;
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
