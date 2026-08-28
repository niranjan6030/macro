import { withUser, ok, fail, body } from "@/lib/api";
import {
  profileFor, getProfile, getDay, listDiary, totalsOf, totalsSince,
  weightSeries, listWorkouts, isoDate, daysAgo,
} from "@/lib/db";
import { dailyTargets } from "@/lib/fitness/energy";
import { project } from "@/lib/fitness/projection";
import { reply, type ChatContext, type ChatMessage } from "@/lib/ai/chat";

/**
 * Ask Macro AI something.
 *
 * The whole context is rebuilt from the database on every message rather than
 * being carried in the conversation. It costs a few queries, and it means the
 * coach is never answering from a snapshot that went stale two questions ago —
 * log a meal mid-conversation and the next answer already knows about it.
 */
export const POST = withUser(async (uid, req) => {
  const b = await body<{ messages?: ChatMessage[] }>(req);
  const history = (b.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    // Enough to hold a thread, short enough to stay cheap.
    .slice(-14);

  if (!history.length || history.at(-1)!.role !== "user") {
    return fail("Ask something first.");
  }

  const profile = await profileFor(uid);
  if (!profile) {
    return fail("Finish setting up your profile and Macro AI can be useful.", 428);
  }

  const today = isoDate(null);
  const [stored, day, entries, week, weights, workouts] = await Promise.all([
    getProfile(uid),
    getDay(uid, today),
    listDiary(uid, today),
    totalsSince(uid, daysAgo(today, 14)),
    weightSeries(uid, daysAgo(today, 30)),
    listWorkouts(uid, daysAgo(today, 14)),
  ]);

  const targets = dailyTargets(profile);
  const totals = totalsOf(entries);
  const forecast = project(profile, stored?.kcal_override ?? targets.kcal);

  const logged = week.filter((d) => d.kcal > 0);
  const weekAvgKcal = logged.length
    ? Math.round(logged.reduce((t, d) => t + d.kcal, 0) / logged.length)
    : null;

  const trendChangeKg = weights.length >= 4
    ? Math.round((weights.at(-1)!.trendKg - weights[0].trendKg) * 10) / 10
    : null;

  const context: ChatContext = {
    name: stored?.display_name ?? null,
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: Math.round(profile.weightKg * 10) / 10,
    bodyFatPct: targets.bodyFatPct,
    goal: profile.goal,
    targetWeightKg: profile.targetWeightKg ?? null,
    targets: {
      kcal: stored?.kcal_override ?? targets.kcal,
      protein: stored?.protein_override ?? targets.protein,
      carbs: stored?.carbs_override ?? targets.carbs,
      fat: stored?.fat_override ?? targets.fat,
      fibre: targets.fibre,
      tdee: targets.tdee,
      bmr: targets.bmr,
    },
    today: {
      kcal: Math.round(totals.kcal), protein: Math.round(totals.protein),
      carbs: Math.round(totals.carbs), fat: Math.round(totals.fat),
      fibre: Math.round(totals.fibre),
    },
    remaining: {
      kcal: Math.round(targets.kcal - totals.kcal),
      protein: Math.round(targets.protein - totals.protein),
      carbs: Math.round(targets.carbs - totals.carbs),
      fat: Math.round(targets.fat - totals.fat),
    },
    eatenToday: entries.map((e) => ({
      name: e.name, grams: Math.round(e.grams), kcal: e.nutrients.kcal,
    })),
    weekAvgKcal,
    trendChangeKg,
    daysToGoal: forecast.weeksToGoal != null ? forecast.weeksToGoal * 7 : null,
    goalVerdict: forecast.verdict,
    recentWorkouts: workouts.slice(0, 6).map((w) => ({
      date: w.on_date, name: w.name,
      sets: (w.sets ?? []).filter((s) => !s.warmup).length,
    })),
    restDay: day?.rest_day ?? false,
    cheatDay: day?.cheat_day ?? false,
  };

  const answer = await reply(history, context);
  return ok(answer);
});
