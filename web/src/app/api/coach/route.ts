import { withUser, ok, fail } from "@/lib/api";
import {
  db, profileFor, totalsSince, weightSeries, listWorkouts, isoDate, daysAgo,
} from "@/lib/db";
import { review, coachConfigured } from "@/lib/ai/coach";
import { volume } from "@/lib/fitness/training";
import { project } from "@/lib/fitness/projection";
import { dailyTargets } from "@/lib/fitness/energy";

/**
 * The review, cached for the day.
 *
 * Cached because the underlying data only changes as fast as someone eats,
 * and because regenerating it on every tab switch would be paying the model
 * to say the same thing again. `?refresh=1` forces a rebuild.
 */
export const GET = withUser(async (uid, req) => {
  const url = new URL(req.url);
  const today = isoDate(url.searchParams.get("date"));
  const window = Math.min(Math.max(Number(url.searchParams.get("days") ?? 14) || 14, 7), 90);
  const refresh = url.searchParams.get("refresh") === "1";
  const since = daysAgo(today, window);

  const profile = await profileFor(uid);
  if (!profile) {
    return fail("Finish setting up your profile first — height, date of birth and a weight.", 428);
  }

  if (!refresh) {
    const { data } = await db()
      .from("coach_notes").select("body, created_at")
      .eq("uid", uid).eq("on_date", today).eq("kind", "weekly").maybeSingle();
    const cached = data as { body: string; created_at: string } | null;
    if (cached) {
      return ok({ ...(await context(uid, profile, since, today, window)), body: cached.body, cached: true });
    }
  }

  const ctx = await context(uid, profile, since, today, window);

  const { findings, body } = await review({
    profile,
    days: ctx.days,
    weights: ctx.weights,
    workouts: ctx.workouts,
    restDays: ctx.restDays,
    cheatDays: ctx.cheatDays,
  });

  // Best effort: a failed cache write must not lose the review itself.
  await db().from("coach_notes")
    .upsert({ uid, on_date: today, kind: "weekly", body },
            { onConflict: "uid,on_date,kind" })
    .then(undefined, () => undefined);

  return ok({ ...ctx, findings, body, cached: false, ai: coachConfigured });
});

/** Everything the review is computed from, and everything the page shows. */
async function context(
  uid: string,
  profile: NonNullable<Awaited<ReturnType<typeof profileFor>>>,
  since: string,
  today: string,
  window: number,
) {
  const [days, weights, workoutRows, dayRows] = await Promise.all([
    totalsSince(uid, since),
    weightSeries(uid, since),
    listWorkouts(uid, since),
    db().from("days").select("rest_day, cheat_day").eq("uid", uid).gte("on_date", since),
  ]);

  const flags = (dayRows.data ?? []) as { rest_day: boolean; cheat_day: boolean }[];

  const workouts = workoutRows.map((w) => {
    const sets = (w.sets ?? []).filter((s) => !s.warmup);
    return {
      date: w.on_date,
      name: w.name,
      sets: sets.length,
      volumeKg: volume(sets.map((s) => ({ weightKg: Number(s.weight_kg), reps: s.reps }))),
    };
  });

  const targets = dailyTargets(profile);
  const logged = days.filter((d) => d.kcal > 0);
  const avgKcal = logged.length
    ? Math.round(logged.reduce((t, d) => t + d.kcal, 0) / logged.length)
    : null;

  return {
    window, today,
    days, weights, workouts,
    restDays: flags.filter((d) => d.rest_day).length,
    cheatDays: flags.filter((d) => d.cheat_day).length,
    targets,
    /* Two projections side by side: what the plan predicts, and what their
       actual average intake predicts. The gap between them is the honest
       answer to "when will I get there". */
    planned: project(profile, targets.kcal),
    actual: avgKcal != null ? project(profile, avgKcal) : null,
  };
}
