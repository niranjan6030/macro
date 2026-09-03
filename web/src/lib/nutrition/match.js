/**
 * Matching an ingredient name to a real food.
 *
 * Kept beside the food sources rather than with the AI, because there is
 * nothing AI about it: it is string matching over the same Food objects the
 * search returns, and it is worth testing on its own.
 */

/**
 * Pick the food an ingredient line actually meant.
 *
 * The general search ranks confidence above textual closeness, which is right
 * when a person is browsing — a laboratory value for "chicken breast" beats a
 * crowd-sourced "Chicken Flavour Noodles". It is wrong here, where the query
 * is a specific ingredient and the wrong food silently changes the calories.
 * Taking the top hit blindly priced a drumstick as Squashies, a British
 * sweet, and matched the milk in badam milk to curd.
 *
 * So the name is scored first and the source only breaks ties. What a food
 * *is* lives at the front of its name — "Milk, cow, whole" against
 * "Curd / dahi, whole milk" — so the head of the string counts for far more
 * than the tail.
 */
export function bestIngredient(query, hits) {
  if (!hits.length) return null;

  const norm = (x) => x.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const q = norm(query);
  const words = q.split(" ").filter((w) => w.length > 2 && !STATE.has(w));

  // "cooked toor dal" and "uncooked toor dal" differ by a factor of three.
  const wantsCooked = /\b(cooked|boiled|steamed)\b/.test(q);
  const wantsRaw = /\b(raw|uncooked|dry|dried)\b/.test(q);

  let best = null;
  let bestScore = -Infinity;
  const trustedHits = [];
  const shelfHits = [];

  for (const f of hits) {
    const name = norm(f.name ?? "");
    let score = 0;

    if (name === q) score += 100;
    if (name.startsWith(q)) score += 50;

    // Every meaningful word, weighted by how near the front it sits.
    for (const w of words) {
      const at = name.indexOf(w);
      if (at < 0) { score -= 12; continue; }
      score += at === 0 ? 20 : at < 12 ? 12 : 5;
    }

    const isRaw = /\b(raw|uncooked|dry|dried)\b/.test(name);
    const isCooked = /\b(cooked|boiled|steamed)\b/.test(name);
    if (wantsCooked && isRaw) score -= 40;
    if (wantsRaw && isCooked) score -= 40;
    if (wantsCooked && isCooked) score += 10;

    if (f.brand) score -= 4;

    const trusted = f.source === "custom" || f.confidence === "measured";
    const bucket = trusted ? trustedHits : shelfHits;
    bucket.push({ f, score });
    if (score > bestScore) { bestScore = score; best = f; }
  }

  /* Trust is not a tiebreak. Open Food Facts is crowd-sourced and its rows
     are frequently mislabelled — "Basmati rice cooked" carrying the calories
     of raw rice, chicken answered with cooked sausage. So a curated or
     laboratory row that matches at all wins outright, and the shelf is only
     read when nothing better exists. */
  const bestTrusted = trustedHits.sort((a, b) => b.score - a.score)[0];
  if (bestTrusted && bestTrusted.score > 0) return bestTrusted.f;

  const bestShelf = shelfHits.sort((a, b) => b.score - a.score)[0];
  // Nothing scored like a real match. Better to leave it unpriced and say so
  // than to bill the person for a sweet they did not eat.
  return bestShelf && bestShelf.score > 0 ? bestShelf.f : null;
}

/** Words that say how a thing was prepared, not what it is. */
const STATE = new Set(["cooked", "raw", "boiled", "fresh", "whole", "plain", "the", "and"]);
