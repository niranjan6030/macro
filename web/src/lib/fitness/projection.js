/**
 * How long it will actually take.
 *
 * The familiar "3500 kcal = 1 lb" rule is a straight line, and bodies are
 * not. It assumes the deficit you start with is the deficit you keep, when
 * in fact every kilogram lost lowers BMR, lowers the cost of carrying
 * yourself around, and narrows the gap — which is exactly why linear
 * calculators promise a date that arrives with 4 kg still to go.
 *
 * So this simulates forward a week at a time and recomputes expenditure from
 * the new body each step. Two further corrections make it honest:
 *
 *   · Forbes' rule partitions the change between fat and lean tissue. Losing
 *     when lean is the leaner you are, the more of the loss comes from
 *     muscle — so body composition is tracked, not just the scale number.
 *   · Adaptive thermogenesis. Sustained restriction suppresses expenditure
 *     by more than the weight change alone predicts. Around 10% at the low
 *     end of the literature; that is what is applied here.
 *
 *   Forbes GB (1987) Human Body Composition
 *   Hall KD et al. (2011) Lancet 378:826-37
 *   Rosenbaum M & Leibel RL (2010) Int J Obes 34:S47-55
 */

import { bmr, estimateBodyFatPct, round1, tdee } from "./energy";

/** Energy density of the two tissues, kcal/kg. */
const KCAL_PER_KG_FAT = 9440;
const KCAL_PER_KG_LEAN = 1816;

/** Ceiling on metabolic adaptation, as a fraction of TDEE. */
const MAX_ADAPTATION = 0.1;
/** How quickly adaptation sets in — most of it inside the first two months. */
const ADAPTATION_WEEKS = 8;

const MAX_WEEKS = 104;

/**
 * Project bodyweight forward at a fixed daily intake.
 *
 * `intakeKcal` is what they will actually eat — pass the target from
 * `dailyTargets` to see the plan, or their logged average to see the truth.
 */
export function project(profile, intakeKcal, from = new Date()) {
  const target = profile.targetWeightKg ?? null;
  const startBf = profile.bodyFatPct ?? estimateBodyFatPct(profile);

  let weightKg = profile.weightKg;
  let fatKg = weightKg * (startBf / 100);
  let leanKg = weightKg - fatKg;

  const weeks = [];
  let weeksToGoal = null;

  // Which side of the target we start on, so we know when we have crossed it.
  const losing = target != null ? target < weightKg : intakeKcal < tdee(profile);

  for (let week = 1; week <= MAX_WEEKS; week++) {
    const current = {
      ...profile,
      weightKg,
      bodyFatPct: (fatKg / weightKg) * 100,
    };

    /* Expenditure at today's body, discounted by adaptation. Adaptation only
       applies in a deficit — eating above maintenance does not suppress
       metabolism, it raises it, and that is already in the weight term. */
    const raw = tdee(current);
    const inDeficit = intakeKcal < raw;
    const adaptation = inDeficit ? MAX_ADAPTATION * (1 - Math.exp(-week / ADAPTATION_WEEKS)) : 0;
    const expenditure = raw * (1 - adaptation);

    const weeklyBalance = (intakeKcal - expenditure) * 7;

    /* Forbes: the fraction of the change that is lean tissue depends on how
       much fat is on the body. p is the energy share going to fat. */
    const fatShare = fatKg > 0 ? fatKg / (fatKg + 10.4) : 0;
    const leanShare = 1 - fatShare;

    const kcalPerKg = fatShare * KCAL_PER_KG_FAT + leanShare * KCAL_PER_KG_LEAN;
    const deltaKg = weeklyBalance / kcalPerKg;

    /* Above maintenance, how much of the surplus can become muscle is capped
       by training, not by calories. Beyond roughly 0.25 kg/week of lean gain
       the rest is fat, whatever the split says. */
    let deltaFat;
    let deltaLean;
    if (deltaKg > 0) {
      deltaLean = Math.min(deltaKg * leanShare, 0.25);
      deltaFat = deltaKg - deltaLean;
    } else {
      deltaFat = deltaKg * fatShare;
      deltaLean = deltaKg * leanShare;
    }

    fatKg = Math.max(fatKg + deltaFat, weightKg * 0.03); // essential fat
    leanKg = Math.max(leanKg + deltaLean, 1);
    weightKg = fatKg + leanKg;

    weeks.push({
      week,
      weightKg: round1(weightKg),
      bodyFatPct: round1((fatKg / weightKg) * 100),
      leanKg: round1(leanKg),
      tdee: Math.round(expenditure),
    });

    if (weeksToGoal == null && target != null) {
      const reached = losing ? weightKg <= target : weightKg >= target;
      if (reached) weeksToGoal = week;
    }

    /* Settled: at this intake the body will not move further. Rather than
       cutting the series short, hold the final state out to the full range —
       callers index this array by week (the deadline search, the chart), and
       a short array would read as "no data" instead of "no change". */
    if (Math.abs(deltaKg) < 0.005 && week > 4) {
      const settled = weeks[weeks.length - 1];
      for (let rest = week + 1; rest <= MAX_WEEKS; rest++) {
        weeks.push({ ...settled, week: rest });
      }
      break;
    }
  }

  const goalDate =
    weeksToGoal != null
      ? new Date(from.getTime() + weeksToGoal * 7 * 86_400_000).toISOString().slice(0, 10)
      : null;

  return {
    weeks,
    weeksToGoal,
    goalDate,
    startWeightKg: round1(profile.weightKg),
    targetWeightKg: target,
    verdict: verdictFor(profile, intakeKcal, weeksToGoal, weeks),
  };
}

function verdictFor(profile, intakeKcal, weeksToGoal, weeks) {
  const maintenance = Math.round(tdee(profile));
  const gap = Math.round(intakeKcal - maintenance);

  if (profile.targetWeightKg == null) {
    if (Math.abs(gap) < 75) return `At ${Math.round(intakeKcal)} kcal you are holding steady.`;
    return gap < 0
      ? `${Math.abs(gap)} kcal below maintenance — losing steadily.`
      : `${gap} kcal above maintenance — gaining steadily.`;
  }

  if (weeksToGoal != null) {
    const months = weeksToGoal / 4.345;
    const when = weeksToGoal <= 8 ? `${weeksToGoal} weeks` : `about ${Math.round(months)} months`;
    return `On ${Math.round(intakeKcal)} kcal a day you reach ${profile.targetWeightKg} kg in ${when}.`;
  }

  // Never arrives. Say why, and say it plainly.
  const settled = weeks.at(-1);
  if (!settled) return "Not enough information to project.";
  return gap < 0
    ? `At ${Math.round(intakeKcal)} kcal you level off around ${settled.weightKg} kg — short of ${profile.targetWeightKg} kg. You would need to eat less, or move more, to go further.`
    : `At ${Math.round(intakeKcal)} kcal you level off around ${settled.weightKg} kg, without reaching ${profile.targetWeightKg} kg.`;
}

/**
 * Work backwards: what intake hits the target by a chosen date?
 *
 * Binary search over the simulation, because the model has no closed form.
 * Returns null when the date is not reachable safely — the caller should say
 * so rather than prescribing something dangerous.
 */
export function intakeForDeadline(profile, weeks) {
  const target = profile.targetWeightKg;
  if (target == null || weeks < 1) return null;

  const floor = profile.sex === "male" ? 1500 : 1200;
  let lo = Math.max(floor, bmr(profile) * 0.85);
  let hi = tdee(profile) * 1.6;

  /* Refuse before searching if the deadline cannot be met inside the safe
     range, in either direction. Returning the nearest bound instead would
     hand back an intake that quietly misses the date — the caller needs to
     be able to tell the person the deadline is the thing that has to move. */
  const losing = target < profile.weightKg;
  const atFloor = project(profile, lo).weeks[weeks - 1];
  const atCeiling = project(profile, hi).weeks[weeks - 1];
  if (losing && atFloor && atFloor.weightKg > target) return null;
  if (!losing && atCeiling && atCeiling.weightKg < target) return null;

  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const at = project(profile, mid).weeks[weeks - 1];
    if (!at) break;
    if (at.weightKg > target) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}
