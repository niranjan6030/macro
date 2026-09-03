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
  // An exact alias is an exact match: "dosa" names "Dosa, plain" as surely
  // as the display name does.
  const exact = name === query || (f.aliases ?? []).some((a) => a.toLowerCase() === query);

  if (exact) s += 60;
  else if (name.startsWith(query)) s += 40;
  else if (name.includes(query)) s += 22;

  // Every query word that appears somewhere in the name.
  const words = query.split(/\s+/).filter((w) => w.length > 2);
  s += words.filter((w) => name.includes(w)).length * 8;

  s += f.confidence === "measured" ? 25 : f.confidence === "label" ? 15 : 5;

  /* Local staples are curated for this audience, and a nudge was not enough.
     Searching "pongal" put a crowd-sourced row at 125 kcal above the checked
     entry at 165, because Open Food Facts rows claim "label" — copied off a
     packet — which outscores the honest "estimated" on a dish nobody can
     read a panel for. Dedupe could not catch it either: the two names differ by
     enough to look like different foods. For an app built around Indian
     cooking, the vetted row wins for its own dish. */
  if (f.source === "custom") s += 30;
  // Shorter names are usually the plainer, more basic food.
  s -= Math.min(name.length / 12, 8);

  return s;
}

/**
 * Two sources describing the same food; keep the more trustworthy one.
 *
 * "Trustworthy" cannot be read off the confidence field alone. Open Food
 * Facts rows declare themselves "label" — copied from a packet — which
 * outranks the honest "estimated" on a curated composite dish, so searching
 * "sambar" deleted this app's own vetted entry and kept a crowd-sourced
 * packet at 50 kcal per 100 g. The curated table is the reason Indian food
 * works here at all; it is not something a supermarket listing gets to
 * evict.
 */
function dedupe(list) {
  const seen = new Map();
  const confidenceRank = { measured: 3, label: 2, estimated: 1 };
  // Source outranks claimed confidence. A curated row was checked by someone;
  // a crowd-sourced one asserted its own accuracy.
  const sourceRank = { custom: 3, usda: 2, openfoodfacts: 1 };
  const better = (a, b) =>
    (sourceRank[a.source] ?? 0) !== (sourceRank[b.source] ?? 0)
      ? (sourceRank[a.source] ?? 0) > (sourceRank[b.source] ?? 0)
      : confidenceRank[a.confidence] > confidenceRank[b.confidence];

  for (const f of list) {
    const key =
      f.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 24) + (f.brand ? `|${f.brand.toLowerCase()}` : "");
    const existing = seen.get(key);
    if (!existing || better(f, existing)) seen.set(key, f);
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
