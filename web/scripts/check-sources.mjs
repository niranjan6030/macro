/**
 * Live checks against the nutrition sources.
 *
 * Separate from `npm run check` because these need the network and depend on
 * services that are occasionally down — a failure here is worth looking at,
 * but it is not necessarily a bug in this repo.
 *
 * The thing being guarded is subtle and was a real bug: Open Food Facts is
 * full of products that have been photographed but not transcribed. They come
 * back with an empty nutriments object, which reads as a food with zero
 * calories — so a bag of crisps could be logged as free. Every result must
 * carry an actual panel.
 *
 * Run: npm run check:sources
 */
import assert from "node:assert/strict";
import * as off from "../.check/nutrition/openfoodfacts.js";
import * as indian from "../.check/nutrition/indian.js";
import { forGrams, plausible } from "../.check/nutrition/types.js";

let passed = 0, skipped = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) {
    if (e.message === "SKIP") { skipped++; console.log(`  skip ${name} (source unreachable)`); return; }
    console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1;
  }
};

console.log("\nOpen Food Facts (live)");

await check("text search returns usable results", async () => {
  const hits = await off.search("dark chocolate", 6);
  if (!hits.length) throw new Error("SKIP");
  assert.ok(hits.length > 0);
});

await check("every result carries a real nutrition panel", async () => {
  const queries = ["maggi noodles", "amul butter", "greek yoghurt", "cornitos nacho crisps"];
  let seen = 0;
  for (const q of queries) {
    const hits = await off.search(q, 8);
    for (const h of hits) {
      seen++;
      const n = h.per100g;
      const empty = n.kcal === 0 && n.protein === 0 && n.carbs === 0 && n.fat === 0;
      assert.ok(!empty, `"${h.name}" came back with an empty panel`);
      assert.ok(plausible(n), `"${h.name}" is not plausible: ${JSON.stringify(n)}`);
    }
  }
  if (seen === 0) throw new Error("SKIP");
  console.log(`       (${seen} results checked)`);
});

await check("barcode lookup returns the manufacturer's panel", async () => {
  const food = await off.byBarcode("8906082570252");
  if (!food) throw new Error("SKIP");
  assert.equal(food.confidence, "label");
  assert.equal(food.source, "openfoodfacts");
  assert.ok(food.per100g.kcal > 100, `got ${food.per100g.kcal} kcal/100g`);
  assert.ok(food.brand, "should carry a brand");
});

await check("a barcode that does not exist returns null, not a guess", async () => {
  assert.equal(await off.byBarcode("0000000000000"), null);
});

await check("a malformed barcode is rejected without a request", async () => {
  assert.equal(await off.byBarcode("12"), null);
  assert.equal(await off.byBarcode("not-a-barcode"), null);
});

console.log("\nIndian table (offline)");

await check("common staples are all findable", () => {
  for (const q of ["dal", "roti", "idli", "paneer", "biryani", "chai", "rice", "egg"]) {
    assert.ok(indian.search(q, 1).length > 0, `"${q}" found nothing`);
  }
});

await check("every row is internally consistent", () => {
  for (const f of indian.FOODS) {
    assert.ok(plausible(f.per100g), `${f.name}: ${JSON.stringify(f.per100g)}`);
  }
  console.log(`       (${indian.FOODS.length} foods checked)`);
});

await check("cooked weights, not raw — rice is not 350 kcal per 100 g", () => {
  const rice = indian.search("steamed rice", 1)[0];
  assert.ok(rice.per100g.kcal < 180,
    `${rice.name} at ${rice.per100g.kcal} kcal/100g looks like raw rice`);
});

await check("a roti comes out at a believable size", () => {
  const roti = indian.search("roti", 1)[0];
  const one = forGrams(roti.per100g, roti.servingG);
  assert.ok(one.kcal > 70 && one.kcal < 160, `one roti = ${one.kcal} kcal`);
});

/* ------------------------------------------------------------------ */
/* Household measures                                                  */
/* ------------------------------------------------------------------ */

const portions = await import("../.check/nutrition/portions.js");

await check("regional Indian cooking is covered, not just the north", () => {
  /* This started at 69 per cent, with South Indian the weakest at fifteen of
     thirty-one — in an app built for India. Rasam was missing outright. */
  const REGIONS = {
    "South Indian": ["idli","dosa","vada","upma","pongal","uttapam","appam","puttu",
      "idiyappam","rasam","sambar","avial","kootu","poriyal","thoran","olan","erissery",
      "curd rice","lemon rice","bisibelebath","kesari","payasam","adai","paniyaram",
      "murukku","molagapodi"],
    "North Indian": ["roti","paratha","naan","bhatura","chole","rajma","dal makhani",
      "palak paneer","aloo gobi","baingan bharta","kadhi","butter chicken","biryani",
      "pulao","raita","lassi","kulcha","dal tadka"],
    "Bengali": ["luchi","shukto","macher jhol","posto","mishti doi","rasgulla","sandesh"],
    "Gujarati / Maharashtrian": ["dhokla","thepla","khandvi","undhiyu","fafda","handvo",
      "shrikhand","pav bhaji","vada pav","poha","puran poli","modak"],
    "Street food": ["samosa","kachori","pani puri","bhel puri","chaat","momos","frankie",
      "dabeli","pakora","bonda"],
    "Staples": ["rice","atta","besan","suji","toor dal","moong dal","urad dal","chana dal",
      "masoor dal","curd","paneer","ghee","jaggery","tamarind","coconut","milk"],
  };
  const missing = [];
  for (const list of Object.values(REGIONS)) {
    for (const q of list) if (indian.search(q, 1).length === 0) missing.push(q);
  }
  assert.equal(missing.length, 0, `not in the table: ${missing.join(", ")}`);
});

console.log("\nHousehold measures");

await check("a wet dish is offered bowls, not spoons", () => {
  const { portions: p } = portions.portionsFor({ name: "Sambar", servingG: null });
  const ids = p.map((x) => x.id);
  assert.ok(ids.includes("katori"), `sambar offered ${ids.join(", ")}`);
  assert.ok(!ids.includes("tsp"), "nobody eats sambar by the teaspoon");
});

await check("a drink is offered glasses", () => {
  const { portions: p } = portions.portionsFor({ name: "Badam milk", servingG: null });
  const ids = p.map((x) => x.id);
  assert.ok(ids.includes("glass") || ids.includes("tumbler"), `badam milk offered ${ids.join(", ")}`);
});

await check("ice cream is offered scoops", () => {
  // Asserted on the label, not the id: when the curated table already says a
  // serving is one 60 g scoop, that entry wins and the generic scoop is
  // dropped as a duplicate. What matters is that the word reaches the person.
  const ice = indian.search("ice cream", 1)[0];
  const { portions: p } = portions.portionsFor(ice);
  assert.ok(p.some((x) => /scoop/i.test(x.label)), `offered ${p.map((x) => x.label).join(", ")}`);
  assert.ok(p.every((x) => x.grams < 200), "nobody serves ice cream by the bowlful here");
});

await check("oil is offered spoons, and is not mistaken for a drink", () => {
  const { portions: p } = portions.portionsFor({ name: "Coconut oil", servingG: 14 });
  const ids = p.map((x) => x.id);
  assert.ok(ids.includes("tsp"), `oil offered ${ids.join(", ")}`);
  assert.ok(!ids.includes("glass"), "coconut oil is not a glass of anything");
});

await check("a food's own serving leads, because someone weighed it", () => {
  const roti = indian.search("roti", 1)[0];
  const { portions: p } = portions.portionsFor(roti);
  assert.equal(p[0].grams, roti.servingG, "the curated serving should come first");
});

await check("every offered measure lands on a sane weight", () => {
  for (const f of indian.FOODS) {
    for (const p of portions.portionsFor(f).portions) {
      assert.ok(p.grams > 0 && p.grams <= 500, `${f.name} / ${p.label} = ${p.grams} g`);
    }
  }
  console.log(`       (${indian.FOODS.length} foods checked)`);
});

/* ------------------------------------------------------------------ */
/* Matching an ingredient to a food                                    */
/*                                                                     */
/* Every case here is one the estimator actually got wrong on          */
/* production before this function existed.                            */
/* ------------------------------------------------------------------ */

const { bestIngredient } = await import("../.check/nutrition/match.js");

const food = (name, extra = {}) => ({
  name, per100g: { kcal: 100 }, source: "openfoodfacts", confidence: "estimated", ...extra,
});

console.log("\nIngredient matching");

await check("the curated table answers multi-word queries", () => {
  // Phrase-only matching returned nothing for any of these, which made the
  // whole table invisible to the recipe estimator and to anyone typing more
  // than one word into search.
  for (const [q, want] of [
    ["basmati rice cooked", /basmati/i],
    ["chicken meat cooked", /chicken/i],
    ["toor dal cooked", /toor/i],
    ["whole milk", /milk/i],
  ]) {
    const hits = indian.search(q, 6);
    assert.ok(hits.length, `"${q}" found nothing in the curated table`);
    assert.ok(want.test(hits[0].name), `"${q}" -> ${hits[0].name}`);
  }
});

await check("a curated row beats a crowd-sourced one outright, not on points", () => {
  const hit = bestIngredient("basmati rice cooked", [
    // Open Food Facts is full of rows like this: named cooked, priced raw.
    food("Basmati rice cooked", { per100g: { kcal: 350 } }),
    food("Rice, basmati, cooked", { source: "custom", confidence: "measured", per100g: { kcal: 121 } }),
  ]);
  assert.equal(hit.per100g.kcal, 121, `picked ${hit.name} at ${hit.per100g.kcal} kcal`);
});

await check("chicken is chicken, not sausage", () => {
  const hit = bestIngredient("chicken meat cooked", [
    food("Chicken cooked sausage"),
    food("Chicken breast, skinless, cooked", { source: "custom", confidence: "measured" }),
  ]);
  assert.equal(hit.name, "Chicken breast, skinless, cooked");
});

await check("an onion is not breaded onion rings in aioli", () => {
  const hit = bestIngredient("onion", [
    food("Onion rings*sauce aioli*rondelles d'oignons panees"),
    food("Onion, raw", { source: "custom", confidence: "measured" }),
  ]);
  assert.equal(hit.name, "Onion, raw");
});

await check("the checked entry leads for its own dish", async () => {
  /* "dosa" returned a crowd-sourced row at 360 kcal — a dry mix — above the
     checked 168, because the ranker compared only against the display name
     and "Dosa, plain" scored as a prefix while the other took the exact
     match. An exact alias is an exact match. */
  const { searchAll } = await import("../.check/nutrition/search.js");
  for (const dish of ["dosa", "idli", "sambar", "rasam", "pongal"]) {
    const top = (await searchAll(dish, 3))[0];
    assert.equal(top?.source, "custom",
      `"${dish}" led with ${top?.name} [${top?.source}] at ${top?.per100g.kcal} kcal`);
  }
});

await check("a branded search still finds the brand", async () => {
  // The curated boost must not bury a packet somebody is holding.
  const { searchAll } = await import("../.check/nutrition/search.js");
  const top = (await searchAll("amul butter", 3))[0];
  assert.ok(top && /amul/i.test(`${top.name} ${top.brand ?? ""}`),
    `led with ${top?.name} instead of the Amul packet`);
});

await check("a supermarket listing cannot evict the curated entry", async () => {
  // Deduping on claimed confidence alone deleted the vetted "Sambar" and
  // kept a crowd-sourced packet at 50 kcal per 100 g.
  const { searchAll } = await import("../.check/nutrition/search.js");
  const hits = await searchAll("sambar", 8);
  const mine = hits.find((f) => f.source === "custom" && /^sambar$/i.test(f.name));
  assert.ok(mine, `curated sambar missing from: ${hits.map((f) => f.name).join(", ")}`);
});

await check("a substring coincidence does not win", () => {
  // "raw" lives inside "prawns", so a plain substring search ranks prawns
  // first for "almonds raw". The matcher has to see past that.
  const pick = bestIngredient("almonds raw", indian.search("almonds raw", 6));
  assert.match(pick.name, /almond/i, `picked ${pick.name}`);
});

await check("a describing word does not have to match", () => {
  for (const [q, want] of [["onion sauteed", /onion/i], ["tomato pureed", /tomato/i],
                           ["paneer cubes", /paneer/i]]) {
    const pick = bestIngredient(q, indian.search(q, 6));
    assert.ok(pick && want.test(pick.name), `"${q}" -> ${pick?.name ?? "nothing"}`);
  }
});

await check("milk means milk, not curd that happens to say milk", () => {
  const hit = bestIngredient("milk", [
    food("Curd / dahi, whole milk", { source: "custom", confidence: "measured" }),
    food("Milk, cow, whole", { source: "custom", confidence: "measured" }),
  ]);
  assert.equal(hit.name, "Milk, cow, whole");
});

await check("a drumstick is not a sweet", () => {
  const hit = bestIngredient("drumstick vegetable", [
    food("Squashies"),
    food("Drumstick, cooked", { source: "custom" }),
  ]);
  assert.equal(hit.name, "Drumstick, cooked");
});

await check("cooked dal is not dry dal", () => {
  const hit = bestIngredient("toor dal cooked", [
    food("Uncooked Toor Dal"),
    food("Dal, toor / arhar, cooked", { source: "custom", confidence: "measured" }),
  ]);
  assert.equal(hit.name, "Dal, toor / arhar, cooked");
});

await check("and dry means dry, when that is what was asked", () => {
  const hit = bestIngredient("raw toor dal", [
    food("Dal, toor / arhar, cooked", { source: "custom" }),
    food("Toor dal, dry"),
  ]);
  assert.equal(hit.name, "Toor dal, dry");
});

await check("a generic food beats a branded one of the same name", () => {
  const hit = bestIngredient("sunflower oil", [
    food("Sunflower Oil", { brand: "Fortune" }),
    food("Cooking oil (any)", { source: "custom", confidence: "measured" }),
    food("Sunflower oil", { source: "custom", confidence: "measured" }),
  ]);
  assert.equal(hit.brand, undefined, `picked the branded one: ${hit.name}`);
});

await check("nothing plausible returns nothing, rather than a wrong answer", () => {
  assert.equal(bestIngredient("drumstick", [food("Squashies"), food("Toffee Bonbons")]), null);
  assert.equal(bestIngredient("anything", []), null);
});

console.log(`\n${passed} checks passed${skipped ? `, ${skipped} skipped` : ""}.\n`);
