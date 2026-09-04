/**
 * The science, checked against published reference values.
 *
 * check-model tests the code against its own helpers, which catches typos and
 * misses whole formulas being wrong. This one hard-codes the answers from the
 * papers — Mifflin-St Jeor's constants, Katch-McArdle, Epley, the MET
 * equation — so a formula that quietly drifts has something to fail against.
 *
 * It also asserts the app cannot contradict itself: the target it prescribes
 * and the forecast it draws have to use the same metabolic model. They did
 * not, and someone sitting exactly at maintenance was told they would gain
 * three kilos.
 */
import assert from "node:assert/strict";
const E = await import("../.check/fitness/energy.js");
const T = await import("../.check/fitness/training.js");
const A = await import("../.check/fitness/activities.js");
const P = await import("../.check/fitness/projection.js");

let bad = 0;
const chk = (name, fn) => {
  try { fn(); console.log(`  ok    ${name}`); }
  catch (e) { bad++; console.log(`  BUG   ${name}\n          ${e.message}`); }
};

const man = { sex:"male", age:28, heightCm:175, weightKg:82.4, activity:"moderate",
              goal:"lose", targetWeightKg:70, trainingDaysPerWeek:4, bodyFatPct:null };

console.log("Energy");
chk("Mifflin-St Jeor matches the published formula", () => {
  // 10W + 6.25H - 5A + 5 = 824 + 1093.75 - 140 + 5 = 1782.75
  assert.ok(Math.abs(E.bmr(man) - 1782.75) < 1, `got ${E.bmr(man)}`);
});
chk("the female constant is -161, not +5", () => {
  const w = { ...man, sex:"female" };
  // 824 + 1093.75 - 140 - 161 = 1616.75
  assert.ok(Math.abs(E.bmr(w) - 1616.75) < 1, `got ${E.bmr(w)}`);
});
chk("Katch-McArdle is used when body fat is known", () => {
  const k = { ...man, bodyFatPct: 20 };           // lean = 65.92
  // 370 + 21.6 * 65.92 = 1793.9
  assert.ok(Math.abs(E.bmr(k) - 1793.9) < 3, `got ${E.bmr(k)}`);
});
chk("TDEE exceeds BMR", () => assert.ok(E.tdee(man) > E.bmr(man)));
chk("a cut is below maintenance and a bulk above", () => {
  const cut = E.dailyTargets(man).kcal;
  const bulk = E.dailyTargets({ ...man, goal:"gain", targetWeightKg:90 }).kcal;
  const hold = E.dailyTargets({ ...man, goal:"maintain", targetWeightKg:82.4 }).kcal;
  assert.ok(cut < hold, `cut ${cut} not below maintain ${hold}`);
  assert.ok(bulk > hold, `bulk ${bulk} not above maintain ${hold}`);
});
chk("no target ever falls below the safety floor", () => {
  for (const w of [45, 50, 60, 82, 120, 160]) {
    for (const sex of ["male","female"]) {
      const t = E.dailyTargets({ ...man, sex, weightKg:w, targetWeightKg:w*0.7 });
      const floor = sex === "male" ? 1500 : 1200;
      assert.ok(t.kcal >= floor, `${sex} ${w}kg -> ${t.kcal} kcal, below ${floor}`);
    }
  }
});
chk("the macro split adds up to the calorie target", () => {
  for (const g of ["lose","maintain","gain"]) {
    const t = E.dailyTargets({ ...man, goal:g, targetWeightKg: g==="gain"?90:70 });
    const sum = t.protein*4 + t.carbs*4 + t.fat*9;
    assert.ok(Math.abs(sum - t.kcal) / t.kcal < 0.06, `${g}: macros ${Math.round(sum)} vs ${t.kcal}`);
  }
});
chk("protein never exceeds a sane ceiling per kg", () => {
  const t = E.dailyTargets(man);
  const perKg = t.protein / man.weightKg;
  assert.ok(perKg > 1.2 && perKg < 3.5, `${perKg.toFixed(2)} g/kg`);
});
chk("nothing returns NaN for a plausible person", () => {
  for (const [k,v] of Object.entries(E.dailyTargets(man))) {
    assert.ok(v === null || Number.isFinite(v), `${k} = ${v}`);
  }
});

console.log("\nBody composition");
chk("BMI matches weight over height squared", () => {
  const t = E.dailyTargets(man);
  assert.ok(Math.abs(t.bmi - 82.4/(1.75*1.75)) < 0.1, `got ${t.bmi}`);
});
chk("lean mass plus fat mass equals bodyweight", () => {
  const t = E.dailyTargets({ ...man, bodyFatPct: 22 });
  const fat = man.weightKg * 0.22;
  assert.ok(Math.abs(t.leanKg + fat - man.weightKg) < 0.5, `lean ${t.leanKg} + fat ${fat.toFixed(1)}`);
});

console.log("\nTraining");
chk("Epley one-rep max is right at a known point", () => {
  // 100 kg x 1 rep is 100 kg, by definition.
  assert.ok(Math.abs(T.e1rm(100, 1) - 100) < 1, `got ${T.e1rm(100,1)}`);
});
chk("more reps at the same weight means a higher estimated max", () => {
  assert.ok(T.e1rm(100, 8) > T.e1rm(100, 5));
});
chk("volume is weight times reps summed", () => {
  const v = T.volume([{ weightKg:100, reps:5 }, { weightKg:80, reps:10 }]);
  assert.equal(v, 500 + 800);
});
chk("the first session prescribes something, not nothing", () => {
  const ex = T.byId("bench");
  const p = T.nextPrescription(ex, null);
  assert.ok(p && (p.sets ?? 0) > 0, JSON.stringify(p));
});
chk("hitting the top of the range adds weight", () => {
  const ex = T.byId("bench");
  const top = ex.repRange[1];
  const last = [{ weightKg:60, reps:top }, { weightKg:60, reps:top }, { weightKg:60, reps:top }];
  const next = T.nextPrescription(ex, last);
  assert.ok(next.weightKg > 60, `stayed at ${next.weightKg} after maxing the range`);
});
chk("missing the range does not add weight", () => {
  const ex = T.byId("bench");
  const low = ex.repRange[0];
  const last = [{ weightKg:60, reps:low-1 }, { weightKg:60, reps:low-1 }];
  const next = T.nextPrescription(ex, last);
  assert.ok(next.weightKg <= 60, `added weight to ${next.weightKg} after missing reps`);
});

console.log("\nActivity");
chk("calories burned are net of resting, not gross", () => {
  // 30 min at 8 MET, 80 kg. Net uses (MET-1).
  const net = A.caloriesBurned(8, 80, 30);
  const gross = A.grossCalories(8, 80, 30);
  assert.ok(net < gross, `net ${net} not below gross ${gross}`);
  assert.ok(Math.abs(net - (8-1)*80*0.0175*30) < 2, `got ${net}`);
});
chk("zero minutes burns nothing", () => assert.equal(A.caloriesBurned(8, 80, 0), 0));

console.log("\nProjection");
chk("a cut loses weight over time", () => {
  const p = P.project(man, E.dailyTargets(man).kcal);
  const last = p.weeks.at(-1);
  assert.ok(last.weightKg < man.weightKg, `ended at ${last.weightKg} from ${man.weightKg}`);
});
chk("someone already at goal is not told to keep going", () => {
  const at = { ...man, weightKg:70, targetWeightKg:70, goal:"maintain" };
  const p = P.project(at, E.dailyTargets(at).kcal);
  assert.ok(Math.abs(p.weeks.at(-1).weightKg - 70) < 3, `drifted to ${p.weeks.at(-1).weightKg}`);
});
chk("body fat never goes negative or above 100", () => {
  const lean = { ...man, weightKg:60, bodyFatPct:8, targetWeightKg:55 };
  const p = P.project(lean, E.dailyTargets(lean).kcal);
  for (const w of p.weeks) assert.ok(w.bodyFatPct > 0 && w.bodyFatPct < 100, `bf ${w.bodyFatPct}`);
});
chk("lean mass is never negative", () => {
  const p = P.project(man, 1200);
  for (const w of p.weeks) assert.ok(w.leanKg > 0, `lean ${w.leanKg}`);
});

console.log(bad ? `\n${bad} LOGIC BUG(S)\n` : "\nNo logic bugs found.\n");
