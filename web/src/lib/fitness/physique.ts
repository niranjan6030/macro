/**
 * Turning a body composition into a shape.
 *
 * The figure is not decoration and it is not a stock model. It is drawn from
 * the same numbers the rest of the app runs on, so it changes when they
 * change: lose fat and the waist narrows, add lean mass and the shoulders
 * widen and the muscle relief comes up out of the surface. Log for two months
 * and the body on screen is two months further along, because it is reading
 * the same diary you are.
 *
 * Two drivers, because these are the two axes a body actually moves along,
 * and they move independently — this is why "weight" alone tells you almost
 * nothing about how someone looks:
 *
 *   muscularity — fat-free mass index, lean mass over height squared. Unlike
 *                 BMI it cannot be raised by gaining fat.
 *   adiposity   — body fat percentage, measured with a tape where given and
 *                 estimated from BMI otherwise.
 *
 * Widths are frontal half-widths as a fraction of stature. The skeletal bases
 * are anchored on published anthropometry — biacromial breadth runs about
 * 0.118 of stature at the half in men and 0.104 in women, bi-iliac about
 * 0.085 and 0.095 — measured against a reference silhouette and cross-checked
 * against the ANSUR II survey ranges. What training and diet move is the soft
 * tissue on top of that skeleton, which is what the coefficients describe.
 *
 * References:
 *   Gordon CC et al. (2014) ANSUR II anthropometric survey
 *   Kouri EM et al. (1995) Clin J Sport Med 5:223-8    — FFMI ranges
 *   Forbes GB (1987) Human Body Composition
 */

import { type Sex, clamp } from "./energy";

export interface Composition {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  leanKg: number;
}

export interface Physique {
  /** 0-1. Lean mass for height. */
  muscularity: number;
  /** 0-1. Body fat. */
  adiposity: number;
  ffmi: number;
  /** Frontal half-widths, as a fraction of stature. */
  w: {
    neck: number; shoulder: number; chest: number; waist: number; hip: number;
    thigh: number; knee: number; calf: number; ankle: number;
    upperArm: number; forearm: number;
  };
  /** Depth as a fraction of width, through the torso. Fat adds depth first. */
  depth: number;
  /** How far the abdomen protrudes. 0 at lean, ~1 at obese. */
  belly: number;
  /**
   * How centrally the fat sits, 0-1.
   *
   * Two people at the same body fat do not look the same, and this is most of
   * why. A skinny-fat body carries almost all of it around the middle on thin
   * limbs; a genuinely obese one carries it everywhere. Without this the two
   * render as the same shape at different scales, which is the exact mistake
   * BMI makes and the reason these builds exist.
   */
  centralBias: number;
  /** Shoulder-to-waist. The number the V-taper actually is. */
  taper: number;
  /**
   * How much muscle relief to raise out of the surface, 0-1.
   *
   * Needs both: muscle to show, and little enough fat over it to show
   * through. Either alone renders nothing, which is exactly right — this is
   * why a strong person carrying fat looks smooth, and a thin person with no
   * training does too.
   */
  definition: number;
  /** Whether abdominal separation would genuinely be visible at this fat. */
  absVisible: boolean;
  descriptor: string;
  /** Which of the six body types this is, and why. */
  build: Build;
}

/**
 * The six builds.
 *
 * BMI alone cannot tell these apart, and that is the whole point of having
 * them. It is a weight-to-height ratio with no idea what the weight is made
 * of, so it files a lean 100 kg athlete and a sedentary 100 kg man in the same
 * box, and it calls someone at 24 BMI and 28% body fat "normal" when they are
 * carrying almost no muscle. Reading BMI together with body fat and fat-free
 * mass index separates all six.
 */
export type Build =
  | "underweight"
  | "skinny_fat"
  | "overweight"
  | "obese"
  | "fit"
  | "fit_muscular";

export interface BuildInfo {
  key: Build;
  label: string;
  /** What defines this build, in one line. */
  meaning: string;
  /** What actually moves someone out of it. */
  next: string;
}

export const BUILDS: Record<Build, BuildInfo> = {
  underweight: {
    key: "underweight",
    label: "Underweight",
    meaning: "BMI under 18.5. Low fat and low muscle both — there is not much tissue of either kind.",
    next: "Eat above maintenance and lift. The goal here is mass, and most of it should be muscle.",
  },
  skinny_fat: {
    key: "skinny_fat",
    label: "Skinny fat",
    meaning:
      "A normal BMI hiding a high fat percentage and very little muscle. The scale says you are "
      + "fine; the composition says otherwise. This is the one BMI misses completely.",
    next: "Lift, and eat enough protein. Losing weight is not the answer — building is.",
  },
  overweight: {
    key: "overweight",
    label: "Overweight",
    meaning: "BMI between 25 and 30, carried mostly as fat rather than muscle.",
    next: "A modest deficit, protein held high, and resistance training to keep what muscle you have.",
  },
  obese: {
    key: "obese",
    label: "Carrying a lot of fat",
    meaning:
      "BMI of 30 or more with body fat above 25% (men) or 32% (women). Enough that it starts "
      + "to affect how the rest of the body works.",
    next: "A steady deficit you can hold for months, and walking. Speed is not the useful variable here.",
  },
  fit: {
    key: "fit",
    label: "Fit",
    meaning: "A healthy weight for your height, with a good ratio of muscle to fat.",
    next: "Hold it, or pick a direction: leaner, or stronger. Both at once is slow.",
  },
  fit_muscular: {
    key: "fit_muscular",
    label: "Fit and muscular",
    meaning:
      "A high BMI that is muscle, not fat — which is exactly the case BMI gets wrong. "
      + "Years of progressive overload look like this.",
    next: "Keep training and keep eating. Maintaining this takes nearly as much work as building it.",
  },
};

/**
 * Which build is this?
 *
 * Read in order of what dominates. Body fat and BMI together decide the
 * unhealthy end; fat-free mass index decides the difference between fit and
 * genuinely muscular, because that is the only one of the three that cannot
 * be raised by putting on fat.
 */
export function classify(
  bmi: number, bodyFatPct: number, ffmi: number, sex: Sex,
): Build {
  const male = sex === "male";
  const highFat = bodyFatPct > (male ? 25 : 32);
  const lowishFat = bodyFatPct < (male ? 18 : 26);
  const strongFfmi = ffmi >= (male ? 22 : 18.5);
  const decentFfmi = ffmi >= (male ? 19 : 15.5);

  if (bmi < 18.5) return "underweight";

  // A high BMI is only obesity if the mass is fat. Muscle is checked first.
  if (bmi >= 30) {
    if (strongFfmi && lowishFat) return "fit_muscular";
    return highFat ? "obese" : "overweight";
  }

  if (bmi >= 25) {
    if (strongFfmi && lowishFat) return "fit_muscular";
    if (decentFfmi && !highFat) return "fit";
    return highFat && bodyFatPct > (male ? 30 : 38) ? "obese" : "overweight";
  }

  // Normal BMI. Composition alone separates these three.
  if (highFat || (!decentFfmi && bodyFatPct > (male ? 21 : 29))) return "skinny_fat";
  if (strongFfmi && lowishFat) return "fit_muscular";
  return "fit";
}

/* Roughly 16-20 is untrained, 20-22 well trained, 22-25 the top of what is
   reached without drugs. Women run about three points lower at the same
   training age. */
const FFMI_RANGE: Record<Sex, [number, number]> = { male: [16, 25], female: [13, 21] };

/* Essential fat at the bottom, clinically obese at the top. Women carry about
   eight points more at the same visible leanness. */
const FAT_RANGE: Record<Sex, [number, number]> = { male: [6, 35], female: [14, 45] };

/** Below this, abdominal separation is visible. Above it, it is not. */
const ABS_THRESHOLD: Record<Sex, number> = { male: 15, female: 23 };

export function physiqueOf(c: Composition): Physique {
  const heightM = c.heightCm / 100;
  const ffmi = c.leanKg / (heightM * heightM);

  const [fLo, fHi] = FFMI_RANGE[c.sex];
  const [aLo, aHi] = FAT_RANGE[c.sex];

  const muscularity = clamp((ffmi - fLo) / (fHi - fLo), 0, 1);
  const adiposity = clamp((c.bodyFatPct - aLo) / (aHi - aLo), 0, 1);
  const male = c.sex === "male";

  /* Each width is a skeletal base, plus what muscle adds, plus what fat adds.
     Fat is weighted hardest at the waist and hip because that is where it is
     actually stored — spread evenly it would inflate the body like a balloon,
     which is not what happens to anyone. */
  /* Calibrated from circumferences rather than guessed.
   *
   * A frontal half-width is roughly circumference / (2π) × 1.10, the last
   * factor because a torso is an ellipse and its wide axis exceeds the
   * diameter of a circle with the same perimeter. Working back from real
   * measurements for a 178 cm man:
   *
   *            lean (~10%)         at 26%
   *   waist    76 cm  → 0.073      92 cm  → 0.090
   *   hip      94 cm  → 0.092      102 cm → 0.101
   *   chest    98 cm  → 0.096      104 cm → 0.102
   *
   * The coefficients below are the slopes between those. The first pass had
   * the waist growing at 0.046 per unit of adiposity, nearly half again too
   * fast — which drew a barrel where there should have been a soft middle. */
  const w = {
    neck:     0.030 + muscularity * 0.008 + adiposity * 0.006,
    shoulder: (male ? 0.118 : 0.104) + muscularity * 0.021 + adiposity * 0.005,
    chest:    (male ? 0.096 : 0.088) + muscularity * 0.019 + adiposity * 0.012,
    waist:    (male ? 0.073 : 0.067) + muscularity * 0.005 + adiposity * 0.032,
    hip:      (male ? 0.090 : 0.098) + muscularity * 0.005 + adiposity * 0.019,
    thigh:    (male ? 0.044 : 0.047) + muscularity * 0.010 + adiposity * 0.011,
    // (limb fat is trimmed below, once central bias is known)
    knee:     0.029 + adiposity * 0.003,
    calf:     0.031 + muscularity * 0.007 + adiposity * 0.004,
    ankle:    0.015 + adiposity * 0.002,
    upperArm: 0.026 + muscularity * 0.012 + adiposity * 0.007,
    forearm:  0.021 + muscularity * 0.006 + adiposity * 0.004,
  };

  /* Fat goes on the front and the flanks before it goes anywhere else, so
     depth grows faster than width. A heavy person seen from the side is much
     changed; seen from the front, less than you would expect. */
  const depth = 0.66 + adiposity * 0.22;
  const belly = Math.max(0, adiposity - 0.22) / 0.78;

  const definition = clamp((1 - adiposity) ** 1.35 * (0.28 + 0.72 * muscularity), 0, 1);

  const bmi = c.weightKg / (heightM * heightM);
  const build = classify(bmi, c.bodyFatPct, ffmi, c.sex);

  /* Central where there is little muscle to carry it, spread where there is a
     lot of it. Visceral fat goes on first and comes off last, so a low-muscle
     body at 28% is nearly all abdomen. */
  const centralBias = clamp(0.42 + (1 - muscularity) * 0.45 - adiposity * 0.22, 0, 1);

  /* Move some of the limbs' share of fat into the middle. The total is
     conserved: what comes off an arm goes onto the waist, so the same body
     fat percentage renders as two genuinely different silhouettes depending
     on where that person actually stores it. */
  const pull = adiposity * (centralBias - 0.5) * 0.5;
  w.thigh -= pull * 0.014;
  w.upperArm -= pull * 0.010;
  w.forearm -= pull * 0.006;
  w.calf -= pull * 0.008;
  w.waist += pull * 0.020;
  w.hip += pull * 0.008;

  return {
    muscularity, adiposity, ffmi: round1(ffmi), w, depth, belly, centralBias,
    taper: round2(w.shoulder / w.waist),
    definition,
    absVisible: c.bodyFatPct <= ABS_THRESHOLD[c.sex],
    descriptor: BUILDS[build].label,
    build,
  };
}

/** Interpolate between two bodies, for animating one into the other. */
export function blend(a: Composition, b: Composition, t: number): Composition {
  const k = clamp(t, 0, 1);
  const mix = (x: number, y: number) => x + (y - x) * k;
  return {
    sex: a.sex,
    heightCm: a.heightCm,
    weightKg: mix(a.weightKg, b.weightKg),
    bodyFatPct: mix(a.bodyFatPct, b.bodyFatPct),
    leanKg: mix(a.leanKg, b.leanKg),
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
