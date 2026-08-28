import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { type Profile, dailyTargets } from "@/lib/fitness/energy";
import { project } from "@/lib/fitness/projection";

/**
 * The weekly review.
 *
 * Everything quantitative is computed before the model is called — adherence,
 * the trend, whether the deficit is landing — and handed over as findings.
 * The model's job is to turn those findings into advice a person will act on,
 * not to work out the arithmetic. Same division as the food photo: the
 * numbers come from code, the language comes from the model.
 *
 * This matters more than it sounds. Asked to "analyse my week", a model will
 * cheerfully invent an average and congratulate you on it.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export const coachConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

export interface WeekData {
  profile: Profile;
  /** Daily intake over the window, most recent last. */
  days: { date: string; kcal: number; protein: number; carbs: number; fat: number; fibre: number }[];
  weights: { date: string; weightKg: number; trendKg: number }[];
  workouts: { date: string; name: string; sets: number; volumeKg: number }[];
  restDays: number;
  cheatDays: number;
}

export interface Findings {
  daysLogged: number;
  daysInWindow: number;
  avgKcal: number | null;
  avgProtein: number | null;
  avgFibre: number | null;
  targetKcal: number;
  targetProtein: number;
  /** Measured change in the smoothed trend over the window, kg. */
  trendChangeKg: number | null;
  /** What the intake predicted would happen, kg. */
  predictedChangeKg: number | null;
  sessionsDone: number;
  sessionsPlanned: number;
  /** Real expenditure implied by intake and actual weight change. */
  impliedTdee: number | null;
  notes: string[];
}

/**
 * Work out what is actually true about the week.
 *
 * `impliedTdee` is the useful one: given what they ate and what the trend
 * did, this is what they must really be burning. It is worth more than any
 * equation, because it is measured from this person rather than predicted
 * from a population — but only once there are enough days to be meaningful,
 * so it stays null until then.
 */
export function analyse(data: WeekData): Findings {
  const { profile, days, weights, workouts } = data;
  const targets = dailyTargets(profile);
  const notes: string[] = [];

  const logged = days.filter((d) => d.kcal > 0);
  const daysLogged = logged.length;

  const avg = (pick: (d: typeof logged[number]) => number) =>
    daysLogged ? Math.round(logged.reduce((t, d) => t + pick(d), 0) / daysLogged) : null;

  const avgKcal = avg((d) => d.kcal);
  const avgProtein = avg((d) => d.protein);
  const avgFibre = avg((d) => d.fibre);

  /* Trend, not raw weight. Comparing the first and last scale readings of a
     fortnight can show a gain during a genuine loss, purely on water. */
  let trendChangeKg: number | null = null;
  if (weights.length >= 4) {
    trendChangeKg = round1(weights.at(-1)!.trendKg - weights[0].trendKg);
  }

  let predictedChangeKg: number | null = null;
  let impliedTdee: number | null = null;

  if (avgKcal != null && daysLogged >= 4) {
    const span = Math.max(days.length, 1);
    const predicted = project(profile, avgKcal).weeks[Math.round(span / 7) - 1];
    if (predicted) predictedChangeKg = round1(predicted.weightKg - profile.weightKg);

    if (trendChangeKg != null && weights.length >= 7) {
      const spanDays = daySpan(weights[0].date, weights.at(-1)!.date) || span;
      // 7700 kcal per kg is right for this direction: we are reading an
      // energy balance off a known mass change, not projecting one forward.
      const surplus = (trendChangeKg * 7700) / spanDays;
      const t = Math.round(avgKcal - surplus);
      if (t > 900 && t < 6000) impliedTdee = t;
    }
  }

  // Findings worth saying out loud, computed rather than inferred.
  if (daysLogged < days.length * 0.6) {
    notes.push(`Only ${daysLogged} of ${days.length} days were logged, so the averages are thin.`);
  }
  if (avgProtein != null && avgProtein < targets.protein * 0.8) {
    notes.push(`Protein averaged ${avgProtein} g against a ${targets.protein} g target.`);
  }
  if (avgFibre != null && avgFibre < targets.fibre * 0.7) {
    notes.push(`Fibre averaged ${avgFibre} g against ${targets.fibre} g.`);
  }
  if (impliedTdee != null && Math.abs(impliedTdee - targets.tdee) > 250) {
    notes.push(
      `Measured expenditure is about ${impliedTdee} kcal, against an estimate of ${targets.tdee}. `
      + `The measurement is the better number.`,
    );
  }
  if (data.cheatDays > 2) {
    notes.push(`${data.cheatDays} cheat days in this window.`);
  }
  if (workouts.length === 0 && (profile.trainingDaysPerWeek ?? 0) > 0) {
    notes.push("No sessions logged in this window.");
  }

  return {
    daysLogged,
    daysInWindow: days.length,
    avgKcal, avgProtein, avgFibre,
    targetKcal: targets.kcal,
    targetProtein: targets.protein,
    trendChangeKg,
    predictedChangeKg,
    sessionsDone: workouts.length,
    sessionsPlanned: Math.round(((profile.trainingDaysPerWeek ?? 0) * days.length) / 7),
    impliedTdee,
    notes,
  };
}

const SYSTEM = `You write the weekly review inside a fitness tracking app.

You are given findings that have already been computed from the person's
logged data. Treat them as the only facts available.

Hard rules:
- Never invent a number. If a figure is not in the findings, do not state it.
- Never contradict the findings. If measured expenditure differs from the
  estimate, the measurement wins.
- Null means not enough data. Say what is missing, do not guess around it.

How to write:
- Address them as "you". Plain British English, no exclamation marks.
- Lead with what the data actually shows, then at most two things to change.
- Be specific and actionable: "add a palm of paneer at lunch" beats
  "increase protein intake".
- Around 120 words. No headings, no bullet lists, no preamble.
- If they are on track, say so briefly rather than manufacturing a problem.
- Never give medical advice. If the findings suggest something clinical —
  very low intake, rapid loss — tell them to talk to a doctor, plainly.`;

export async function review(data: WeekData): Promise<{ findings: Findings; body: string }> {
  const findings = analyse(data);
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) return { findings, body: fallback(findings, data.profile) };

  try {
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: JSON.stringify({
          goal: data.profile.goal,
          target_weight_kg: data.profile.targetWeightKg,
          current_weight_kg: data.profile.weightKg,
          training_days_per_week: data.profile.trainingDaysPerWeek,
          rest_days: data.restDays,
          cheat_days: data.cheatDays,
          findings,
          recent_sessions: data.workouts.slice(0, 6),
        }, null, 2),
      }],
    });

    const text = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text).join("").trim();

    return { findings, body: text || fallback(findings, data.profile) };
  } catch (e) {
    console.error("[coach] review failed", e);
    return { findings, body: fallback(findings, data.profile) };
  }
}

/**
 * The review without the model.
 *
 * Not an apology — the findings are the substance, and they are computed
 * either way. This just states them, so the feature works with no API key
 * at all and degrades in quality rather than disappearing.
 */
function fallback(f: Findings, profile: Profile): string {
  const parts: string[] = [];

  if (f.daysLogged === 0) {
    return "Nothing logged in this window yet. Log a few days and this becomes useful — "
      + "four is enough to see a trend.";
  }

  parts.push(`You logged ${f.daysLogged} of ${f.daysInWindow} days.`);
  if (f.avgKcal != null) {
    const gap = f.avgKcal - f.targetKcal;
    parts.push(
      Math.abs(gap) < 100
        ? `Intake averaged ${f.avgKcal} kcal, right on your ${f.targetKcal} target.`
        : `Intake averaged ${f.avgKcal} kcal against a ${f.targetKcal} target — ${Math.abs(gap)} ${gap > 0 ? "over" : "under"}.`,
    );
  }
  if (f.trendChangeKg != null) {
    const dir = f.trendChangeKg < 0 ? "down" : f.trendChangeKg > 0 ? "up" : "level";
    parts.push(`Your trend weight is ${dir}${f.trendChangeKg !== 0 ? ` ${Math.abs(f.trendChangeKg)} kg` : ""}.`);
  }
  if (f.impliedTdee != null) {
    parts.push(`Measured against the scale, you are burning about ${f.impliedTdee} kcal a day.`);
  }
  if (f.sessionsPlanned > 0) {
    parts.push(`${f.sessionsDone} of ${f.sessionsPlanned} planned sessions done.`);
  }
  parts.push(...f.notes);

  if (parts.length <= 2) {
    parts.push(`Keep going — ${profile.goal === "lose" ? "the deficit only works if it is boring" : "consistency is the whole game"}.`);
  }
  return parts.join(" ");
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const daySpan = (a: string, b: string) =>
  Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));
