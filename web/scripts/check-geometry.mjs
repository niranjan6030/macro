/**
 * Measuring the figure.
 *
 * The relief and the classification have their own checks; this one asks a
 * different and more basic question — is the *body* the right shape? It builds
 * the mesh and takes calipers to it, then compares against published
 * anthropometry for a 178 cm man.
 *
 * These are the measurements a tailor or an ergonomist would take, and they
 * are the ones that catch the errors nobody notices by eye: a foot two
 * centimetres short, an arm span that does not match the height, knees wider
 * than hips. Every one of those was wrong at some point in this file's life.
 *
 *   Gordon CC et al. (2014) ANSUR II
 *   Pheasant S (2003) Bodyspace, 2nd ed.
 *
 * Run: npm run check:geometry
 */
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildBody } from "../.check3/body.js";

const HEIGHT_CM = 178;

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

/* The mesh is centred on the origin and one unit tall, so a measurement in
   figure units times the stature is centimetres. */
function measure(physique) {
  const g = buildBody(physique);
  const pos = g.getAttribute("position");

  g.computeBoundingBox();
  const box = g.boundingBox;
  const unitHeight = box.max.y - box.min.y;
  const floor = box.min.y;

  /* Torso breadth in a horizontal slice.
   *
   * Not simply max-x minus min-x: the arms hang beside the torso and fall in
   * every slice from the shoulder down, so that measures across the hands and
   * reports a 59 cm waist. A caliper on a real person is placed on the trunk,
   * with the arms lifted out of the way.
   *
   * So the points are sorted outward from the centre line and the first real
   * gap is found. Everything inside that gap is the trunk; everything beyond
   * it is an arm. The gap is unmistakable — there are centimetres of air
   * between a rib and a wrist — which makes this far more robust than trying
   * to identify the arm geometry itself. */
  const trunkHalfWidth = (fracLo, fracHi) => {
    const lo = floor + unitHeight * fracLo;
    const hi = floor + unitHeight * fracHi;
    const xs = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y >= lo && y <= hi) xs.push(Math.abs(pos.getX(i)));
    }
    if (!xs.length) return 0;
    xs.sort((a, b) => a - b);

    const gapLimit = unitHeight * 0.012;   // ~2 cm on a 178 cm figure
    let edge = xs[0];
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > gapLimit) break;
      edge = xs[i];
    }
    return edge;
  };

  const widthAt = (fracLo, fracHi) => trunkHalfWidth(fracLo, fracHi) * 2;

  /* Depth, trunk only, by the same reasoning — at hip height the hands are
     well forward of the buttocks and would otherwise set the figure's depth. */
  const depthAt = (fracLo, fracHi) => {
    const lo = floor + unitHeight * fracLo;
    const hi = floor + unitHeight * fracHi;
    const half = trunkHalfWidth(fracLo, fracHi) * 1.05;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < lo || y > hi) continue;
      if (Math.abs(pos.getX(i)) > half) continue;
      const z = pos.getZ(i);
      if (z < min) min = z;
      if (z > max) max = z;
    }
    return max - min;
  };

  /* At floor level there is nothing but feet, so the plain extent is right. */
  const fullDepthAt = (fracLo, fracHi) => {
    const lo = floor + unitHeight * fracLo;
    const hi = floor + unitHeight * fracHi;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < lo || y > hi) continue;
      const z = pos.getZ(i);
      if (z < min) min = z;
      if (z > max) max = z;
    }
    return max - min;
  };

  const cm = (u) => (u / unitHeight) * HEIGHT_CM;

  return {
    cm,
    unitHeight,
    totalWidthCm: cm(box.max.x - box.min.x),
    totalDepthCm: cm(box.max.z - box.min.z),
    shoulderCm: cm(widthAt(0.775, 0.805)),
    chestCm: cm(widthAt(0.695, 0.715)),
    waistCm: cm(widthAt(0.570, 0.590)),
    hipCm: cm(widthAt(0.492, 0.512)),
    kneeCm: cm(widthAt(0.255, 0.275)),
    ankleCm: cm(widthAt(0.045, 0.065)),
    footLenCm: cm(fullDepthAt(0.0, 0.05)),
    headDepthCm: cm(depthAt(0.90, 0.96)),
    chestDepthCm: cm(depthAt(0.695, 0.715)),
  };
}

const man = (kg, bf) => ({
  sex: "male", heightCm: HEIGHT_CM, weightKg: kg, bodyFatPct: bf,
  leanKg: kg * (1 - bf / 100),
});

// Physique is a TS module; the bundled body.js carries its own copy, so the
// composition is converted here the same way physiqueOf does.
const { physiqueOf } = await import("../.check/fitness/physique.js");

console.log("\nBody geometry — a lean 178 cm man, 75 kg at 14%");
const m = measure(physiqueOf(man(75, 14)));

const within = (name, got, lo, hi) =>
  assert.ok(got >= lo && got <= hi,
    `${name} is ${got.toFixed(1)} cm, expected ${lo}-${hi}`);

check("bideltoid breadth", () => {
  // Across the deltoids, which is the widest the shoulders get. ANSUR II puts
  // the male mean near 49 cm, and this figure is a lean 178 cm.
  within("bideltoid", m.shoulderCm, 44, 54);
});

check("waist breadth", () => {
  within("waist", m.waistCm, 24, 34);
});

/* Chest breadth is deliberately not measured here.
 *
 * With the arms hanging, the upper arm rests against the ribs — there is no
 * gap to find, so a caliper cannot get to the chest and neither can this. On a
 * real person it is measured with the arms raised. The chest-to-waist
 * relationship is checked instead in the physique tests, on the widths that
 * drive the geometry, where it is unambiguous. */

check("hips are wider than knees, and knees than ankles", () => {
  assert.ok(m.hipCm > m.kneeCm, `hip ${m.hipCm.toFixed(1)} vs knee ${m.kneeCm.toFixed(1)}`);
  assert.ok(m.kneeCm > m.ankleCm, `knee ${m.kneeCm.toFixed(1)} vs ankle ${m.ankleCm.toFixed(1)}`);
});

check("hip breadth", () => {
  // Bi-iliac breadth plus soft tissue: 32-38 cm.
  within("hip", m.hipCm, 30, 39);
});

check("foot length is about 15% of stature", () => {
  within("foot", m.footLenCm, 23, 30);
});

check("the head is deeper than the chest is not", () => {
  // Head depth 19-21 cm; the chest is deeper still.
  within("head depth", m.headDepthCm, 17, 23);
  assert.ok(m.chestDepthCm > m.headDepthCm,
    `chest depth ${m.chestDepthCm.toFixed(1)} should exceed head ${m.headDepthCm.toFixed(1)}`);
});

check("total width, arms included, is about a quarter of height", () => {
  within("total width", m.totalWidthCm, 40, 58);
});

console.log("\nHow the build changes the measurements");
const lean = measure(physiqueOf(man(75, 14)));
const heavy = measure(physiqueOf(man(105, 36)));

check("gaining fat widens the waist far more than the shoulders", () => {
  const waistGain = heavy.waistCm - lean.waistCm;
  const shoulderGain = heavy.shoulderCm - lean.shoulderCm;
  assert.ok(waistGain > shoulderGain * 2,
    `waist +${waistGain.toFixed(1)} vs shoulders +${shoulderGain.toFixed(1)}`);
});

check("a heavier body is deeper front to back", () => {
  assert.ok(heavy.chestDepthCm > lean.chestDepthCm);
});

check("the head does not change size with bodyweight", () => {
  assert.ok(Math.abs(heavy.headDepthCm - lean.headDepthCm) < 1.0,
    `head went from ${lean.headDepthCm.toFixed(1)} to ${heavy.headDepthCm.toFixed(1)}`);
});

console.log("\nWomen");
const woman = measure(physiqueOf({
  sex: "female", heightCm: HEIGHT_CM, weightKg: 62, bodyFatPct: 24,
  leanKg: 62 * 0.76,
}));

check("wider hips relative to shoulders than a man", () => {
  const f = woman.hipCm / woman.shoulderCm;
  const mRatio = lean.hipCm / lean.shoulderCm;
  assert.ok(f > mRatio, `female ${f.toFixed(2)} should exceed male ${mRatio.toFixed(2)}`);
});

console.log(`\n${passed} geometry checks passed.\n`);
void THREE;
