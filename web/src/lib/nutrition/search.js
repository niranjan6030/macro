import {} from "./types";
import * as off from "./openfoodfacts";
import * as usda from "./usda";
import * as indian from "./indian";

/**
 * One search across every source, ranked.
 *
 * The three sources answer different questions and are queried in parallel:
 * the local Indian table knows what dinner is, USDA knows what a laboratory
 * measured, Open Food Facts knows what is on the packet. Whichever answers,
 * the result carries its provenance so the UI can show where a number came
 * from — the user should always be able to see whether they are looking at a
 * measured value or an estimate.
 */

export async function searchAll(query, limit = 20) {
  const q = query.trim();
  if (q.length < 2) return [];

  // Local is synchronous and free; the two network calls race each other.
  const local = indian.search(q, 8);
  const [usdaHits, offHits] = await Promise.all([
    usda.search(q, 12).catch(() => []),
    off.search(q, 12).catch(() => []),
  ]);

  const ranked = [...local, ...usdaHits, ...offHits]
    .map((f) => ({ f, score: score(f, q) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);

  return dedupe(ranked).slice(0, limit);
}

/**
 * Ranking.
 *
 * Confidence is weighted above textual closeness on purpose. A laboratory
 * value for "chicken breast" is a better answer to "chicken" than an exact
 * name match on a crowd-sourced entry for "Chicken Flavour Noodles".
 */
function score(f, q) {
  const name = f.name.toLowerCase();
  const query = q.toLowerCase();

  let s = 0;
  if (name === query) s += 60;
  else if (name.startsWith(query)) s += 40;
  else if (name.includes(query)) s += 22;

  // Every query word that appears somewhere in the name.
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  s += words.filter((w) => name.includes(w)).length * 8;

  s += f.confidence === "measured" ? 25 : f.confidence === "label" ? 15 : 5;

  // Local staples are curated for this audience; they earn a nudge.
  if (f.source === "custom") s += 12;
  // Shorter names are usually the plainer, more basic food.
  s -= Math.min(name.length / 12, 8);

  return s;
}

/** Two sources describing the same food; keep the more trustworthy one. */
function dedupe(list) {
  const seen = new Map();
  const rank = { measured: 3, label: 2, estimated: 1 };

  for (const f of list) {
    const key =
      f.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 24) + (f.brand ? `|${f.brand.toLowerCase()}` : "");
    const existing = seen.get(key);
    if (!existing || rank[f.confidence] > rank[existing.confidence]) seen.set(key, f);
  }
  return [...seen.values()];
}

/** Fetch one food by its composite `source:id` handle. */
export async function resolve(source, id) {
  switch (source) {
    case "custom":
      return indian.byId(id);
    case "usda":
      return usda.byId(id);
    case "openfoodfacts":
      return off.byBarcode(id);
    default:
      return null;
  }
}

export { off, usda, indian };
