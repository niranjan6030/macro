import { withUser, ok, fail, body, str } from "@/lib/api";
import { createWorkout, listWorkouts, isoDate, daysAgo } from "@/lib/db";
import { e1rm, volume } from "@/lib/fitness/training";

export const GET = withUser(async (uid, req) => {
  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? 30) || 30, 365);
  const since = daysAgo(isoDate(null), days);

  const workouts = await listWorkouts(uid, since);

  return ok({
    workouts: workouts.map((w) => {
      const sets = (w.sets ?? []).filter((s) => !s.warmup);
      const best = sets.reduce(
        (top, s) => Math.max(top, e1rm(Number(s.weight_kg), s.reps)), 0,
      );
      return {
        ...w,
        totalSets: sets.length,
        volumeKg: volume(sets.map((s) => ({ weightKg: Number(s.weight_kg), reps: s.reps }))),
        bestE1rm: best || null,
      };
    }),
  });
});

export const POST = withUser(async (uid, req) => {
  const b = await body(req);
  const name = str(b.name, 60);
  if (!name) return fail("Name the session.");
  return ok({
    workout: await createWorkout(uid, isoDate(b.date), name, str(b.split, 40)),
  });
});
