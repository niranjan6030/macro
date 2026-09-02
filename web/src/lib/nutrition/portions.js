/**
 * Household measures, because nobody weighs sambar.
 *
 * Asking for grams is the single biggest reason a food diary gets abandoned.
 * It works for a packet, which prints its weight, and it fails for everything
 * that comes out of a pot: dal, sambar, rasam, kheer, badam milk, a scoop of
 * ice cream. Nobody owns a scale in the kitchen and nobody wants to.
 *
 * So the question asked is the one a person can actually answer — how many
 * katori, how many glasses, how many pieces — and the grams are worked out
 * behind it. Grams remain the unit of record, because that is what the
 * per-100 g panels multiply against; they are just no longer what someone
 * has to invent.
 *
 * The weights are standard Indian household measures. A katori is the small
 * steel bowl on every thali; a tumbler is the steel cup tea comes in. These
 * vary between houses, which is why the grams stay visible and editable —
 * an estimate you can see and correct beats a number you had to guess.
 */

/** One of each, in grams. Volumes assume roughly the density of water. */
export const MEASURES = {
  katori_small: { label: "Small katori", grams: 100, hint: "half-filled steel bowl" },
  katori:       { label: "Katori",       grams: 150, hint: "the standard thali bowl" },
  bowl:         { label: "Large bowl",   grams: 250, hint: "a full soup bowl" },
  ladle:        { label: "Ladle",        grams: 60,  hint: "one serving spoon" },
  plate:        { label: "Plate",        grams: 350, hint: "a full meal plate" },
  tumbler:      { label: "Tumbler",      grams: 150, hint: "the steel tea cup" },
  glass:        { label: "Glass",        grams: 200, hint: "an ordinary drinking glass" },
  glass_large:  { label: "Large glass",  grams: 250, hint: "a tall glass" },
  cup:          { label: "Cup",          grams: 150, hint: "a tea or coffee cup" },
  scoop:        { label: "Scoop",        grams: 60,  hint: "one ice cream scoop" },
  tbsp:         { label: "Tablespoon",   grams: 15,  hint: "one heaped spoon" },
  tsp:          { label: "Teaspoon",     grams: 5,   hint: "one small spoon" },
  handful:      { label: "Handful",      grams: 30,  hint: "what fits in a closed palm" },
};

/* Which measures suit which kind of food. Matched against the name, because
   that is all a search result reliably carries. Order matters: the first
   pattern that matches wins, so the specific ones come before the general. */
const KINDS = [
  {
    // Fats, before anything else — "coconut oil" must not be read as a drink.
    test: /\b(oil|ghee|butter|mayonnaise|dressing)\b/i,
    measures: ["tsp", "tbsp"],
    note: "Oil is the easiest thing to under-count and the heaviest per spoon.",
  },
  {
    test: /\b(ice ?cream|kulfi|frozen yog|gelato)\b/i,
    measures: ["scoop", "katori_small", "katori"],
  },
  {
    test: /\b(milk|lassi|buttermilk|chaas|juice|smoothie|shake|badam|water|tea|coffee|chai|cola|soda|drink|kadha|sharbat|nimbu)\b/i,
    measures: ["tumbler", "glass", "glass_large", "cup"],
    note: "Measured by the glass — the grams follow from the volume.",
  },
  {
    test: /\b(dal|daal|sambar|rasam|kadhi|curry|gravy|soup|stew|korma|kheer|payasam|halwa|porridge|dalia|khichdi|curd|dahi|yog|raita)\b/i,
    measures: ["katori_small", "katori", "bowl", "ladle"],
    note: "A katori is the small steel bowl on a thali.",
  },
  {
    test: /\b(rice|biryani|pulao|pulav|noodle|pasta|upma|poha|fried rice)\b/i,
    measures: ["katori", "plate", "bowl"],
  },
  {
    test: /\b(almond|cashew|walnut|peanut|pista|nut|seed|raisin|kishmish|namkeen|mixture|sev|chips)\b/i,
    measures: ["handful", "katori_small", "tbsp"],
  },
  {
    test: /\b(sabzi|bhaji|poriyal|vegetable|paneer|chicken|mutton|fish|egg|keema|prawn)\b/i,
    measures: ["katori_small", "katori", "ladle"],
  },
  {
    test: /\b(sugar|honey|jaggery|jam|powder|masala|pickle|achar|chutney)\b/i,
    measures: ["tsp", "tbsp"],
  },
];

/** The fallbacks, for a food whose name says nothing useful. */
const GENERIC = ["katori_small", "katori", "tbsp"];

/**
 * The measures worth offering for one food, best first.
 *
 * A food carrying its own serving from the curated table leads with that —
 * "1 roti = 40 g" beats any generic bowl, because somebody weighed a roti.
 */
export function portionsFor(food) {
  const name = `${food?.name ?? ""} ${food?.brand ?? ""}`;
  const out = [];

  if (food?.servingG > 0) {
    out.push({
      id: "serving",
      label: (food.servingLabel ?? "1 serving").replace(/^1\s+/, ""),
      grams: food.servingG,
      hint: "as this food is normally served",
    });
  }

  const kind = KINDS.find((k) => k.test.test(name));
  for (const id of kind?.measures ?? GENERIC) {
    // Never offer two chips that mean the same weight.
    if (out.some((p) => Math.abs(p.grams - MEASURES[id].grams) < 6)) continue;
    out.push({ id, ...MEASURES[id] });
  }

  // Grams stay available for a packet, which prints its weight.
  out.push({ id: "g100", label: "100 g", grams: 100, hint: "if the packet says so" });
  return { portions: out.slice(0, 5), note: kind?.note ?? null };
}

/** The counts someone actually serves themselves. */
export const COUNTS = [0.5, 1, 1.5, 2, 3];

export const countLabel = (n) =>
  n === 0.5 ? "½" : n === 1.5 ? "1½" : String(n);
