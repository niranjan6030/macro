/**
 * Household measures, because nobody weighs sambar.
 *
 * Asking for grams is the single biggest reason a food diary gets abandoned.
 * It works for a packet, which prints its weight, and it fails for everything
 * else: dal, badam milk, a scoop of ice cream, two biscuits with tea. Nobody
 * owns a kitchen scale and nobody wants to.
 *
 * So the question asked is the one a person can answer — how many katori, how
 * many glasses, how many biscuits — and the grams are worked out behind it.
 * Grams remain the unit of record, because that is what the per-100 g panels
 * multiply against; they are just no longer what someone has to invent.
 *
 * Coverage is the whole point. An earlier version matched a dozen food kinds
 * and dropped everything else onto a generic katori, which meant a biscuit,
 * a slice of bread and a bar of chocolate were all offered as bowls. Four
 * search results in five arrive from Open Food Facts or USDA with no serving
 * weight at all, so the fallback is not a rare edge — it is the common case,
 * and it has to be right. check-sources asserts that no ordinary food lands
 * on the generic guess.
 *
 * The weights are standard Indian household measures. A katori is the small
 * steel bowl on every thali; a tumbler is the steel cup tea comes in. These
 * vary between houses, which is why the grams stay visible and editable — an
 * estimate you can see and correct beats a number you had to guess.
 */

/** One of each, in grams. Volumes assume roughly the density of water. */
export const MEASURES = {
  // Bowls and plates
  katori_small: { label: "Small katori", grams: 100, hint: "half-filled steel bowl" },
  katori:       { label: "Katori",       grams: 150, hint: "the standard thali bowl" },
  bowl:         { label: "Bowl",         grams: 250, hint: "a full soup bowl" },
  bowl_cereal:  { label: "Bowl",         grams: 40,  hint: "a breakfast bowl, dry" },
  plate:        { label: "Plate",        grams: 350, hint: "a full meal plate" },
  ladle:        { label: "Ladle",        grams: 60,  hint: "one serving spoon" },

  // Glasses and cups
  tumbler:      { label: "Tumbler",      grams: 150, hint: "the steel tea cup" },
  glass:        { label: "Glass",        grams: 200, hint: "an ordinary drinking glass" },
  glass_large:  { label: "Large glass",  grams: 250, hint: "a tall glass" },
  cup:          { label: "Cup",          grams: 150, hint: "a tea or coffee cup" },

  // Spoons
  tbsp:         { label: "Tablespoon",   grams: 15,  hint: "one heaped spoon" },
  tsp:          { label: "Teaspoon",     grams: 5,   hint: "one small spoon" },

  // Countable things, which is how most food is actually eaten
  piece:        { label: "Piece",        grams: 50,  hint: "one of them" },
  small_piece:  { label: "Piece",        grams: 25,  hint: "one of them" },
  biscuit:      { label: "Biscuit",      grams: 12,  hint: "one biscuit" },
  slice_bread:  { label: "Slice",        grams: 30,  hint: "one slice of bread" },
  slice_cheese: { label: "Slice",        grams: 20,  hint: "one cheese slice" },
  slice_cake:   { label: "Slice",        grams: 80,  hint: "one slice" },
  slice_pizza:  { label: "Slice",        grams: 100, hint: "one slice" },
  square:       { label: "Square",       grams: 10,  hint: "one square of a bar" },
  bar:          { label: "Bar",          grams: 40,  hint: "a whole bar" },
  egg:          { label: "Egg",          grams: 50,  hint: "one whole egg" },
  fruit:        { label: "Fruit",        grams: 120, hint: "one medium fruit" },
  scoop:        { label: "Scoop",        grams: 60,  hint: "one ice cream scoop" },
  scoop_powder: { label: "Scoop",        grams: 30,  hint: "the scoop in the tub" },

  // Body-referenced, for when nothing else is to hand
  palm:         { label: "Palm",         grams: 100, hint: "a piece the size of your palm" },
  handful:      { label: "Handful",      grams: 30,  hint: "what fits in a closed palm" },

  // The literal fallback, for a packet that prints its weight
  g100:         { label: "100 g",        grams: 100, hint: "if the packet says so" },
};

/* Which measures suit which kind of food, matched against the name — that is
   all a search result reliably carries. Order matters: the first pattern that
   matches wins, so the specific ones come first. "Coconut oil" must be read
   as a fat before it is read as a drink; "ice cream" before "cream". */
/* Which measures suit which kind of food, matched against the name — that is
   all a search result reliably carries.

   Two rules govern this list, and both were learned by getting them wrong.
   Order: a named dish must come before its ingredients, or "Pizza, cheese"
   is read as cheese and offered in slices of twenty grams. And plurals: the
   patterns end in `s?` because "Almonds" is what the database actually calls
   them, and `\balmond\b` does not match it. */
const KINDS = [
  // --- fats first: "coconut oil" must not be read as a drink ------------
  { test: /\b(oils?|ghee|butters?|mayonnaise|dressings?|vanaspati)\b/i,
    measures: ["tsp", "tbsp"],
    note: "Oil is the easiest thing to under-count and the heaviest per spoon." },

  // --- named dishes, before the ingredients they contain ----------------
  { test: /\b(ice ?creams?|kulfi|gelato|frozen yog\w*)\b/i, measures: ["scoop", "katori_small"] },

  { test: /\b(pizzas?)\b/i, measures: ["slice_pizza", "piece"] },

  { test: /\b(burgers?|sandwich\w*|wraps?|frankie|shawarma|hot ?dogs?)\b/i,
    measures: ["piece", "palm"] },

  { test: /\b(cakes?|pastr\w+|brownies?|muffins?|do?nuts?|doughnuts?)\b/i,
    measures: ["slice_cake", "piece"] },

  { test: /\b(protein powders?|whey|casein|mass gainer|isolate)\b/i,
    measures: ["scoop_powder", "tbsp"],
    note: "Use the scoop that came in the tub — they differ between brands." },

  { test: /\b(protein bars?|energy bars?|granola bars?|muesli bars?)\b/i,
    measures: ["bar", "handful"] },

  { test: /\b(biscuits?|cookies?|rusks?|crackers?|khari|marie)\b/i,
    measures: ["biscuit", "handful"] },

  { test: /\b(chocolates?|dairy milk|toblerone|kitkat|cand(y|ies)|toffees?)\b/i,
    measures: ["square", "bar"] },

  { test: /\b(breads?|toasts?|buns?|pav|baguettes?|bagels?|loa(f|ves))\b/i,
    measures: ["slice_bread", "piece"] },

  { test: /\b(eggs?|omelettes?|omelets?|bhurji)\b/i, measures: ["egg", "piece"] },

  { test: /\b(cheeses?|mozzarella|cheddar)\b/i,
    measures: ["slice_cheese", "handful", "katori_small"] },

  { test: /\b(rotis?|chapatis?|phulkas?|parathas?|naans?|puris?|pooris?|bhaturas?|theplas?|kulchas?|dosas?|idlis?|uttapams?|appams?|vadas?|samosas?|pakoras?|bhajis?|kachoris?|momos?|dumplings?|spring rolls?|cutlets?|tikkis?)\b/i,
    measures: ["piece", "small_piece"],
    note: "Counted, not weighed — one roti, two idli." },

  { test: /\b(ladoos?|laddus?|barfis?|burfis?|rasgullas?|gulab jamuns?|jalebis?|pedas?|halwa|kaju katli|sweets?|mithai)\b/i,
    measures: ["piece", "katori_small"] },

  // --- liquids -----------------------------------------------------------
  { test: /\b(milk|lassi|buttermilk|chaas|majjige|juices?|smoothies?|shakes?|badam|water|teas?|chai|coffees?|colas?|sodas?|drinks?|beverages?|kadha|sharbat|nimbu|kombucha)\b/i,
    measures: ["tumbler", "glass", "glass_large", "cup"],
    note: "Measured by the glass — the grams follow from the volume." },

  { test: /\b(cornflakes|cereals?|muesli|granola|oats?|porridge|dalia|bran)\b/i,
    measures: ["bowl_cereal", "katori_small", "tbsp"] },

  { test: /\b(dals?|daals?|sambar|rasam|kadhi|curr(y|ies)|grav(y|ies)|soups?|stews?|korma|kheer|payasam|khichdi|curd|dahi|yog\w*|raita)\b/i,
    measures: ["katori_small", "katori", "bowl", "ladle"],
    note: "A katori is the small steel bowl on a thali." },

  { test: /\b(rice|biryanis?|pulaos?|pulavs?|noodles?|pastas?|spaghetti|macaroni|upma|poha|couscous|quinoa)\b/i,
    measures: ["katori", "plate", "bowl"] },

  { test: /\b(chickens?|muttons?|lamb|beef|pork|fish|prawns?|shrimps?|salmon|tuna|meats?|keema|tikkas?|kebabs?)\b/i,
    measures: ["palm", "piece", "katori_small"],
    note: "A palm-sized piece is about 100 g — the handiest measure there is." },

  { test: /\b(paneer|tofu|soya|soy chunks?)\b/i, measures: ["katori_small", "palm", "handful"] },

  { test: /\b(almonds?|cashews?|walnuts?|peanuts?|pistas?|pistachios?|nuts?|seeds?|raisins?|kishmish|dates?|khajur)\b/i,
    measures: ["handful", "tbsp", "katori_small"] },

  { test: /\b(namkeen|mixture|sev|bhujia|chips|crisps|wafers?|popcorn|nachos|murukku|chakli)\b/i,
    measures: ["handful", "katori_small"] },

  { test: /\b(bananas?|apples?|mangoe?s?|oranges?|guavas?|pears?|peach\w*|plums?|kiwis?|chikoo|sapota|custard apple|pomegranates?|papaya|melons?|grapes?|strawberr\w+|fruits?)\b/i,
    measures: ["fruit", "katori_small", "bowl"] },

  { test: /\b(sugar|honey|jaggery|gur|jams?|syrups?|pickles?|achar|chutney|masala|powders?|salt|sauces?|ketchup)\b/i,
    measures: ["tsp", "tbsp"] },

  { test: /\b(sabzi|poriyal|vegetables?|salads?|spinach|palak|bhindi|gobi|aloo|potatoe?s?|carrots?|beans?|peas?|cabbage|broccoli|cucumbers?|tomatoe?s?|onions?|mushrooms?|corn|beetroot|pumpkin|gourds?)\b/i,
    measures: ["katori_small", "katori", "bowl"] },
];

/* Last resort. Reached only by a food whose name says nothing at all — and
   even then a small bowl and a spoon beat asking for grams. */
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

  out.push({ id: "g100", ...MEASURES.g100 });
  return { portions: out.slice(0, 5), note: kind?.note ?? null, matched: Boolean(kind) };
}

/** The counts someone actually serves themselves. */
export const COUNTS = [0.5, 1, 1.5, 2, 3];

export const countLabel = (n) => (n === 0.5 ? "½" : n === 1.5 ? "1½" : String(n));
