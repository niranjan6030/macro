import assert from "node:assert/strict";
import { bmr, tdee, dailyTargets } from "../.check/fitness/energy.js";
import { project, intakeForDeadline } from "../.check/fitness/projection.js";
import { nextPrescription, e1rm, weekPlan, splitFor } from "../.check/fitness/training.js";
import { forGrams, plausible } from "../.check/nutrition/types.js";

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

console.log("\nEnergy");

// Mifflin-St Jeor, worked by hand:
// 10(80) + 6.25(180) - 5(30) + 5 = 800 + 1125 - 150 + 5 = 1780
const man = { sex: "male", age: 30, heightCm: 180, weightKg: 80,
              activity: "sedentary", goal: "maintain", trainingDaysPerWeek: 0 };
check("BMR matches Mifflin-St Jeor by hand", () => {
  assert.equal(Math.round(bmr(man)), 1780);
});

// 10(60) + 6.25(165) - 5(30) - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
check("BMR is sex-specific", () => {
  const woman = { ...man, sex: "female", weightKg: 60, heightCm: 165 };
  assert.equal(Math.round(bmr(woman)), 1320);
});

check("Katch-McArdle takes over when body fat is known", () => {
  // 370 + 21.6 × (80 × 0.85) = 370 + 1468.8 = 1838.8
  assert.equal(Math.round(bmr({ ...man, bodyFatPct: 15 })), 1839);
});

check("training is added per session, not as a blanket multiplier", () => {
  const rest = tdee({ ...man, trainingDaysPerWeek: 0 });
  const four = tdee({ ...man, trainingDaysPerWeek: 4 });
  const perDay = (4 * 4.4 * 80) / 7;                 // ~201 kcal/day
  assert.ok(Math.abs((four - rest) - perDay) < 1, `got ${four - rest}`);
  // The failure mode being avoided: a 1.55 multiplier would add ~600/day.
  assert.ok(four - rest < 300, "training inflated the estimate");
});

console.log("\nTargets");

check("a deficit never goes below the safety floor", () => {
  const tiny = { sex: "female", age: 55, heightCm: 150, weightKg: 45,
                 activity: "sedentary", goal: "lose", targetWeightKg: 40 };
  assert.ok(dailyTargets(tiny).kcal >= 1200, `got ${dailyTargets(tiny).kcal}`);
});

check("loss is capped at 1% of bodyweight per week", () => {
  const t = dailyTargets({ ...man, goal: "lose", weightKg: 120, targetWeightKg: 85 });
  assert.ok(t.weeklyRateKg >= -1.0, `got ${t.weeklyRateKg}`);
});

check("gain is capped far below loss — muscle is slow", () => {
  const t = dailyTargets({ ...man, goal: "gain", targetWeightKg: 90 });
  assert.ok(t.weeklyRateKg <= 0.35 && t.weeklyRateKg > 0, `got ${t.weeklyRateKg}`);
});

check("protein scales to lean mass, not total weight", () => {
  const lean = dailyTargets({ ...man, bodyFatPct: 10, goal: "lose" });
  const fat  = dailyTargets({ ...man, bodyFatPct: 35, goal: "lose" });
  assert.ok(lean.protein > fat.protein,
    `lean ${lean.protein} should exceed fat ${fat.protein} at the same bodyweight`);
});

check("macros account for the calorie target", () => {
  const t = dailyTargets({ ...man, goal: "lose", targetWeightKg: 72 });
  const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  assert.ok(Math.abs(fromMacros - t.kcal) < 60,
    `macros give ${fromMacros}, target is ${t.kcal}`);
});

console.log("\nProjection");

check("weight loss decelerates rather than running in a straight line", () => {
  const p = { ...man, weightKg: 100, goal: "lose", targetWeightKg: 80 };
  const r = project(p, 2000);
  const week1 = 100 - r.weeks[0].weightKg;
  const week40 = r.weeks[39].weightKg - r.weeks[40]?.weightKg;
  assert.ok(week40 < week1, "later weeks should lose less than the first");
});

check("the naive 7700 rule would overpromise; this does not", () => {
  const p = { ...man, weightKg: 100, goal: "lose", targetWeightKg: 80 };
  const r = project(p, 2000);
  const at26 = r.weeks[25].weightKg;
  // Linear maths on the starting deficit predicts far more loss than this.
  const maintenance = tdee(p);
  const naive = 100 - ((maintenance - 2000) * 7 * 26) / 7700;
  assert.ok(at26 > naive, `model ${at26} should be above naive ${naive.toFixed(1)}`);
});

check("an unreachable target is reported, not promised", () => {
  const p = { ...man, weightKg: 90, goal: "lose", targetWeightKg: 55 };
  const r = project(p, 2600);            // near maintenance
  assert.equal(r.weeksToGoal, null);
  assert.ok(/level off/.test(r.verdict), r.verdict);
});

check("a reachable target gets a date", () => {
  const p = { ...man, weightKg: 90, goal: "lose", targetWeightKg: 85 };
  const r = project(p, 1900);
  assert.ok(r.weeksToGoal > 0, "should reach it");
  assert.match(r.goalDate, /^\d{4}-\d{2}-\d{2}$/);
});

check("body fat falls as weight does, and lean mass is mostly spared", () => {
  const p = { ...man, weightKg: 100, bodyFatPct: 30, goal: "lose", targetWeightKg: 85 };
  const r = project(p, 2000);
  const last = r.weeks.at(-1);
  assert.ok(last.bodyFatPct < 30, "body fat should fall");
  const leanLost = (100 * 0.70) - last.leanKg;
  const totalLost = 100 - last.weightKg;
  assert.ok(leanLost / totalLost < 0.35,
    `${((leanLost / totalLost) * 100).toFixed(0)}% of the loss was lean — too much`);
});

check("intakeForDeadline finds an intake that hits the date", () => {
  const p = { ...man, weightKg: 90, goal: "lose", targetWeightKg: 86 };
  const kcal = intakeForDeadline(p, 12);
  assert.ok(kcal > 1200 && kcal < 3000, `got ${kcal}`);
  const reached = project(p, kcal).weeks[11].weightKg;
  assert.ok(Math.abs(reached - 86) < 0.5, `12 weeks at ${kcal} kcal lands at ${reached}`);
});

check("a deadline that needs an unsafe intake is refused, not fudged", () => {
  // 6 kg in 12 weeks needs more than the lowest safe intake can deliver.
  assert.equal(intakeForDeadline({ ...man, weightKg: 90, goal: "lose", targetWeightKg: 84 }, 12), null);
  // And the same in the other direction: 10 kg of gain in a month is not real.
  assert.equal(intakeForDeadline({ ...man, weightKg: 70, goal: "gain", targetWeightKg: 80 }, 4), null);
});

console.log("\nTraining");

check("Epley e1RM", () => {
  // 100 × (1 + 5/30) = 116.67
  assert.equal(e1rm(100, 5), 116.7);
  assert.equal(e1rm(100, 1), 100);
});

check("hitting the top of the range earns a weight jump", () => {
  const squat = { id: "squat", name: "Squat", primary: "quads", secondary: [],
                  equipment: "barbell", compound: true, repRange: [5, 8], cue: "" };
  const p = nextPrescription(squat, [
    { weightKg: 100, reps: 8, rir: 1 },
    { weightKg: 100, reps: 8, rir: 1 },
    { weightKg: 100, reps: 8, rir: 0 },
  ]);
  assert.equal(p.weightKg, 105, `got ${p.weightKg}`);
  assert.equal(p.reps, 5);
});

check("falling well short of the range backs the weight off", () => {
  const bench = { id: "bench", name: "Bench", primary: "chest", secondary: [],
                  equipment: "barbell", compound: true, repRange: [5, 8], cue: "" };
  const p = nextPrescription(bench, [
    { weightKg: 100, reps: 2, rir: 0 },
    { weightKg: 100, reps: 2, rir: 0 },
  ]);
  assert.ok(p.weightKg < 100, `got ${p.weightKg}`);
  assert.ok(p.weightKg % 1.25 === 0, "must be loadable on real plates");
});

check("mid-range progress adds a rep, not weight", () => {
  const row = { id: "row", name: "Row", primary: "back", secondary: [],
                equipment: "barbell", compound: true, repRange: [6, 10], cue: "" };
  const p = nextPrescription(row, [
    { weightKg: 60, reps: 8, rir: 1 },
    { weightKg: 60, reps: 7, rir: 1 },
  ]);
  assert.equal(p.weightKg, 60);
  assert.equal(p.reps, 9);
});

check("three days a week gets full body, not push/pull/legs", () => {
  assert.equal(splitFor(3), "full_body");
  assert.equal(splitFor(4), "upper_lower");
  assert.equal(splitFor(6), "push_pull_legs");
});

check("the week has the right number of training days", () => {
  for (const days of [1, 2, 3, 4, 5, 6]) {
    const plan = weekPlan(days);
    assert.equal(plan.filter(Boolean).length, days, `${days} days`);
    assert.equal(plan.length, 7);
  }
});

console.log("\nNutrition");

check("scaling per-100g to grams", () => {
  const per100 = { kcal: 143 * (100 / 28), protein: 2, carbs: 18, fat: 7,
                   fibre: 2, sugar: 1, satFat: 3, sodium: 200 };
  const got = forGrams(per100, 150);
  // The packet in the screenshot: 143 kcal / 28 g over a 150 g bag.
  assert.equal(Math.round(got.kcal), 766);
});

check("implausible panels are rejected", () => {
  assert.equal(plausible({ kcal: 8000, protein: 5, carbs: 5, fat: 5, fibre: 0, sugar: 0, satFat: 0, sodium: 0 }), false);
  assert.equal(plausible({ kcal: 100, protein: 60, carbs: 60, fat: 60, fibre: 0, sugar: 0, satFat: 0, sodium: 0 }), false);
  assert.equal(plausible({ kcal: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0, sugar: 0, satFat: 1, sodium: 74 }), true);
  assert.equal(plausible({ kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0, sugar: 0, satFat: 0, sodium: 5 }), true);
});

check("Atwater catches macros that contradict the calories", () => {
  // 143 kcal claimed, but the macros come to ~400.
  assert.equal(plausible({ kcal: 143, protein: 10, carbs: 50, fat: 20, fibre: 2, sugar: 0, satFat: 0, sodium: 0 }), false);
});

console.log(`\n${passed} checks passed.\n`);
