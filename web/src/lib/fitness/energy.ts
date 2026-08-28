/**
 * Energy and macronutrient targets.
 *
 * Every number here comes from a published equation rather than a rule of
 * thumb, because the whole app is only as trustworthy as this file. Where a
 * choice existed, the more accurate equation won even when it needs more
 * input — the app simply asks for the extra input.
 *
 * References, in the order they are used below:
 *   Mifflin MD et al. (1990) Am J Clin Nutr 51:241-7   — BMR from weight/height/age
 *   Katch & McArdle (1996)                             — BMR from lean mass
 *   Deurenberg P et al. (1991) Br J Nutr 65:105-14     — body fat from BMI
 *   Institute of Medicine (2005) DRI for Macronutrients — fibre, protein floor
 *   Helms ER et al. (2014) J Int Soc Sports Nutr 11:20 — protein while cutting
 */

export type Sex = "male" | "female";

/** How much someone moves outside of deliberate training. */
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type Goal = "lose" | "maintain" | "gain";

export interface Profile {
  sex: Sex;
  /** Years. */
  age: number;
  /** Centimetres. */
  heightCm: number;
  /** Kilograms. */
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
  /** Percent, 0-70. Optional — measured beats estimated, so we use it if given. */
  bodyFatPct?: number | null;
  /** Kilograms. Where they want to end up. */
  targetWeightKg?: number | null;
  /** Deliberate training sessions per week. Counted separately from `activity`. */
  trainingDaysPerWeek?: number;
}

/*
 * Activity multipliers.
 *
 * These are the standard Harris-Benedict factors, but applied only to
 * non-exercise activity. Training is added on top per session, because a
 * blanket "very active" multiplier on a 90 kg person is worth ~900 kcal/day
 * and that is where most calculators go badly wrong.
 */
const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,      // desk job, little walking
  light: 1.315,        // on their feet part of the day
  moderate: 1.425,     // manual-ish work, or a lot of walking
  active: 1.55,        // physically demanding job
  very_active: 1.7,    // heavy labour
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Physically demanding job",
};

/** Roughly what one hour of resistance training costs, per kg of bodyweight. */
const TRAINING_KCAL_PER_KG = 4.4;

/** Body fat from BMI, when it has not been measured (Deurenberg). */
export function estimateBodyFatPct(p: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">): number {
  const bmi = bmiOf(p.weightKg, p.heightCm);
  const sexTerm = p.sex === "male" ? 1 : 0;
  const pct = 1.20 * bmi + 0.23 * p.age - 10.8 * sexTerm - 5.4;
  return clamp(pct, 3, 70);
}

export function bmiOf(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Fat-free mass in kg. */
export function leanMassKg(p: Profile): number {
  const bf = p.bodyFatPct ?? estimateBodyFatPct(p);
  return p.weightKg * (1 - bf / 100);
}

/**
 * Basal metabolic rate, kcal/day.
 *
 * Katch-McArdle is used when body fat is actually known, because BMR tracks
 * lean mass far more closely than it tracks total weight — two people at
 * 80 kg and 12% vs 30% body fat do not burn the same at rest. Without a
 * measurement we fall back to Mifflin-St Jeor rather than feeding Katch a
 * guessed body fat, which would launder an estimate into a precise-looking
 * number.
 */
export function bmr(p: Profile): number {
  if (p.bodyFatPct != null && p.bodyFatPct > 0) {
    return 370 + 21.6 * leanMassKg(p);
  }
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

/** Total daily energy expenditure, kcal/day, averaged across the week. */
export function tdee(p: Profile): number {
  const rest = bmr(p) * ACTIVITY_FACTOR[p.activity];
  const days = clamp(p.trainingDaysPerWeek ?? 0, 0, 14);
  const trainingPerWeek = days * TRAINING_KCAL_PER_KG * p.weightKg;
  return rest + trainingPerWeek / 7;
}

/**
 * The safe weekly rate of change for this person, in kg/week.
 *
 * Loss is capped at 1% of bodyweight per week: past that, the share of the
 * loss coming from muscle rather than fat climbs steeply. Gain is capped far
 * lower — muscle simply cannot be built at 1%/week, so anything faster is
 * just fat, and the app should not pretend otherwise.
 */
export function safeWeeklyRateKg(p: Profile): number {
  if (p.goal === "maintain") return 0;
  if (p.goal === "lose") return -Math.min(1.0, p.weightKg * 0.01);
  // Novices can gain lean mass faster than experienced lifters, but we do not
  // know training age yet, so this is the conservative end of the range.
  return Math.min(0.35, p.weightKg * 0.004);
}

export interface Targets {
  bmr: number;
  tdee: number;
  /** Daily calorie target. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  /** Litres. */
  water: number;
  /** kg/week, negative when losing. */
  weeklyRateKg: number;
  bodyFatPct: number;
  leanKg: number;
  bmi: number;
}

/**
 * Daily targets.
 *
 * Macros are set in a fixed order — protein first, then fat, then carbs take
 * whatever is left — because that is the order of physiological priority. A
 * percentage split (the "40/30/30" you see everywhere) gives a 50 kg woman
 * and a 110 kg man the same ratio, which serves neither.
 */
export function dailyTargets(p: Profile): Targets {
  const maintenance = tdee(p);
  const rate = safeWeeklyRateKg(p);

  // 7700 kcal per kg of body tissue is the usual figure; it is the energy
  // density of adipose tissue, and it is only a starting point — the
  // projection model below corrects for what actually happens over time.
  const dailyDelta = (rate * 7700) / 7;
  let kcal = maintenance + dailyDelta;

  // Never prescribe below the floor where micronutrient adequacy becomes
  // impossible, whatever the arithmetic says.
  const floor = p.sex === "male" ? 1500 : 1200;
  kcal = Math.max(kcal, floor, bmr(p) * 0.85);

  const lean = leanMassKg(p);
  const bf = p.bodyFatPct ?? estimateBodyFatPct(p);

  /* Protein.
     Scaled to lean mass, not total weight — fat tissue has no protein
     requirement, and using total weight over-prescribes for anyone carrying
     a lot of it. Requirement rises in a deficit, where protein is what
     protects muscle from being burned alongside the fat. */
  const proteinPerKgLean = p.goal === "lose" ? 2.4 : p.goal === "gain" ? 2.0 : 1.8;
  const protein = Math.round(lean * proteinPerKgLean);

  /* Fat.
     0.8 g/kg of bodyweight is the floor for hormone production and for
     absorbing the fat-soluble vitamins. Above maintenance there is room to
     be more generous. */
  const fatPerKg = p.goal === "gain" ? 1.0 : 0.8;
  const fat = Math.round(p.weightKg * fatPerKg);

  /* Carbohydrate takes the remainder: it is the fuel that is adjustable
     without a physiological cost. */
  const carbKcal = kcal - protein * 4 - fat * 9;
  const carbs = Math.max(50, Math.round(carbKcal / 4));

  // IOM: 14 g of fibre per 1000 kcal.
  const fibre = Math.round((kcal / 1000) * 14);

  // ~35 ml/kg, plus a litre for the training days.
  const water = round1((p.weightKg * 0.035) + ((p.trainingDaysPerWeek ?? 0) >= 3 ? 0.5 : 0));

  return {
    bmr: Math.round(bmr(p)),
    tdee: Math.round(maintenance),
    kcal: Math.round(kcal),
    protein, carbs, fat, fibre, water,
    weeklyRateKg: round2(rate),
    bodyFatPct: round1(bf),
    leanKg: round1(lean),
    bmi: round1(bmiOf(p.weightKg, p.heightCm)),
  };
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;
