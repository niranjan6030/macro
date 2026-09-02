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

console.log(`\n${passed} checks passed${skipped ? `, ${skipped} skipped` : ""}.\n`);
