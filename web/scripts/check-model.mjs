import assert from "node:assert/strict";
import { bmr, tdee, dailyTargets } from "../.check/fitness/energy.js";
import { project, intakeForDeadline } from "../.check/fitness/projection.js";
import { nextPrescription, e1rm, weekPlan, splitFor } from "../.check/fitness/training.js";
import { forGrams, plausible } from "../.check/nutrition/types.js";
import { physiqueOf, blend, classify, BUILDS } from "../.check/fitness/physique.js";

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

console.log("\nCalendar dates");

/* Mirrors lib/client.js. A day is a label, not an instant, and every step has
   to be timezone-independent — the bug this guards against made the "next
   day" arrow do nothing in India and the "previous day" arrow skip two. */
const shiftDate = (iso, days) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

check("stepping a day forward and back is exact, in any timezone", () => {
  for (const tz of ["UTC", "Asia/Kolkata", "America/Los_Angeles", "Pacific/Kiritimati"]) {
    process.env.TZ = tz;
    assert.equal(shiftDate("2026-08-28", 1), "2026-08-29", tz);
    assert.equal(shiftDate("2026-08-28", -1), "2026-08-27", tz);
    assert.equal(shiftDate("2026-08-28", 0), "2026-08-28", tz);
  }
  process.env.TZ = "UTC";
});

check("stepping across a month and a year boundary", () => {
  assert.equal(shiftDate("2026-08-31", 1), "2026-09-01");
  assert.equal(shiftDate("2026-09-01", -1), "2026-08-31");
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDate("2027-01-01", -1), "2026-12-31");
  // A leap year, which 2028 is.
  assert.equal(shiftDate("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftDate("2028-03-01", -1), "2028-02-29");
});

check("a week of steps lands a week away", () => {
  let d = "2026-08-28";
  for (let i = 0; i < 7; i++) d = shiftDate(d, -1);
  assert.equal(d, "2026-08-21");
});

console.log("\nPhysique");

const body = (sex, heightCm, weightKg, bf) => ({
  sex, heightCm, weightKg, bodyFatPct: bf, leanKg: weightKg * (1 - bf / 100),
});

check("losing fat opens the taper", () => {
  const before = physiqueOf(body("male", 178, 95, 32));
  const after = physiqueOf(body("male", 178, 80, 16));
  assert.ok(after.taper > before.taper, `${before.taper} -> ${after.taper}`);
  assert.ok(after.w.waist < before.w.waist);
});

check("adding lean mass widens the shoulders far more than the waist", () => {
  const light = physiqueOf(body("male", 178, 70, 15));
  const built = physiqueOf(body("male", 178, 86, 15));
  const shoulderGain = built.w.shoulder - light.w.shoulder;
  const waistGain = built.w.waist - light.w.waist;
  assert.ok(shoulderGain > waistGain * 3,
    `shoulders +${shoulderGain.toFixed(4)} vs waist +${waistGain.toFixed(4)}`);
});

check("widths match real circumferences", () => {
  // Half-width is about circumference / (2pi) x 1.10 for an elliptical torso.
  const fromCirc = (cm, heightCm) => (cm / (2 * Math.PI)) * 1.10 / heightCm;
  const lean = physiqueOf(body("male", 178, 72, 10));
  const soft = physiqueOf(body("male", 178, 88, 26));
  // 76 cm waist lean, 92 cm at 26%.
  assert.ok(Math.abs(lean.w.waist - fromCirc(76, 178)) < 0.008,
    `lean waist ${lean.w.waist.toFixed(3)} vs ${fromCirc(76, 178).toFixed(3)}`);
  assert.ok(Math.abs(soft.w.waist - fromCirc(92, 178)) < 0.010,
    `soft waist ${soft.w.waist.toFixed(3)} vs ${fromCirc(92, 178).toFixed(3)}`);
});

check("abs are gated on real body fat, not faded in", () => {
  assert.equal(physiqueOf(body("male", 178, 78, 12)).absVisible, true);
  assert.equal(physiqueOf(body("male", 178, 78, 19)).absVisible, false);
  assert.equal(physiqueOf(body("female", 165, 58, 21)).absVisible, true);
  assert.equal(physiqueOf(body("female", 165, 58, 30)).absVisible, false);
});

check("definition needs both muscle and leanness", () => {
  const thin = physiqueOf(body("male", 178, 58, 12));
  const heavyStrong = physiqueOf(body("male", 178, 105, 32));
  const leanStrong = physiqueOf(body("male", 178, 85, 11));
  assert.ok(leanStrong.definition > thin.definition);
  assert.ok(leanStrong.definition > heavyStrong.definition);
});

check("fat adds depth faster than width", () => {
  const lean = physiqueOf(body("male", 178, 72, 10));
  const soft = physiqueOf(body("male", 178, 95, 32));
  assert.ok(soft.depth > lean.depth, "a heavier body is deeper front to back");
  assert.ok(soft.belly > 0.5 && lean.belly < 0.05);
});

check("women carry wider hips relative to shoulders", () => {
  const w = physiqueOf(body("female", 165, 68, 30));
  const m = physiqueOf(body("male", 178, 80, 22));
  assert.ok(w.w.hip / w.w.shoulder > m.w.hip / m.w.shoulder);
});

check("every width stays positive and sane across the whole range", () => {
  for (const sex of ["male", "female"]) {
    for (const bf of [4, 12, 25, 40, 55]) {
      for (const kg of [42, 70, 95, 140]) {
        const p = physiqueOf(body(sex, 170, kg, bf));
        for (const [name, v] of Object.entries(p.w)) {
          assert.ok(v > 0 && v < 0.30, `${sex} ${kg}kg ${bf}%: ${name} = ${v}`);
        }
        assert.ok(p.definition >= 0 && p.definition <= 1);
        assert.ok(p.depth > 0.5 && p.depth < 1.0);
      }
    }
  }
});

check("the six builds are assigned from the right evidence", () => {
  const bmi = (kg, h) => kg / ((h / 100) ** 2);
  const of = (kg, bf, h = 178, sex = "male") =>
    classify(bmi(kg, h), bf, (kg * (1 - bf / 100)) / ((h / 100) ** 2), sex);

  assert.equal(of(55, 11), "underweight", "BMI 17.4");
  assert.equal(of(68, 26), "skinny_fat", "normal BMI, high fat, low muscle");
  assert.equal(of(88, 28), "overweight", "BMI 27.8 carried as fat");
  assert.equal(of(108, 37), "obese", "BMI 34 with 37% fat");
  assert.equal(of(75, 14), "fit", "normal BMI, good muscle, low fat");
  assert.equal(of(90, 10), "fit_muscular", "BMI 28 that is muscle");
});

check("the two cases BMI alone gets wrong", () => {
  const bmi = (kg, h) => kg / ((h / 100) ** 2);
  const of = (kg, bf, h = 178, sex = "male") =>
    classify(bmi(kg, h), bf, (kg * (1 - bf / 100)) / ((h / 100) ** 2), sex);

  // BMI 27.8 would be called overweight; 12% body fat says otherwise.
  assert.equal(of(88, 12), "fit_muscular");
  // BMI 21.5 would be called normal; 26% fat on almost no muscle says otherwise.
  assert.equal(of(68, 26), "skinny_fat");
});

check("women are judged on their own thresholds", () => {
  const bmi = (kg, h) => kg / ((h / 100) ** 2);
  const of = (kg, bf, h = 165) =>
    classify(bmi(kg, h), bf, (kg * (1 - bf / 100)) / ((h / 100) ** 2), "female");

  // 24% would be high for a man and is lean for a woman.
  assert.equal(of(58, 22), "fit");
  assert.equal(of(60, 34), "skinny_fat");
  assert.equal(of(92, 44), "obese");
});

check("every build has a label and a way out of it", () => {
  for (const [key, info] of Object.entries(BUILDS)) {
    assert.equal(info.key, key);
    assert.ok(info.label.length > 2, key);
    assert.ok(info.meaning.length > 30, key);
    assert.ok(info.next.length > 20, `${key} should say what changes it`);
  }
});

check("fat goes where each sex actually stores it", () => {
  const man = physiqueOf(body("male", 178, 92, 30));
  const woman = physiqueOf(body("female", 165, 78, 38));
  assert.ok(man.centralBias > woman.centralBias,
    `male ${man.centralBias.toFixed(2)} should exceed female ${woman.centralBias.toFixed(2)}`);
  // And the shape follows: hips relative to waist.
  assert.ok(woman.w.hip / woman.w.waist > man.w.hip / man.w.waist);
});

check("blend interpolates and clamps at both ends", () => {
  const a = body("male", 178, 90, 28), b = body("male", 178, 76, 15);
  assert.equal(blend(a, b, 0).weightKg, 90);
  assert.equal(blend(a, b, 1).weightKg, 76);
  assert.equal(blend(a, b, 0.5).weightKg, 83);
  assert.equal(blend(a, b, 5).weightKg, 76, "should clamp above 1");
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
