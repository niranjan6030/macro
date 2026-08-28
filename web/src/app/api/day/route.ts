import { withUser, ok, body, num, str, isBool } from "@/lib/api";
import {
  getDay, upsertDay, isoDate, listDiary, totalsOf, profileFor, weightSeries, daysAgo,
} from "@/lib/db";
import { dailyTargets } from "@/lib/fitness/energy";

/**
 * One day: what they ate, what they weighed, and how it compares to target.
 *
 * This is what the home screen reads, so it answers in a single round trip
 * rather than making the client stitch three calls together.
 */
export const GET = withUser(async (uid, req) => {
  const date = isoDate(new URL(req.url).searchParams.get("date"));

  const [day, entries, profile] = await Promise.all([
    getDay(uid, date),
    listDiary(uid, date),
    profileFor(uid),
  ]);

  const totals = totalsOf(entries);
  const targets = profile ? dailyTargets(profile) : null;

  return ok({
    date,
    day: day ?? { uid, on_date: date, rest_day: false, cheat_day: false, water_ml: 0 },
    entries,
    totals,
    targets,
    /* Remaining is clamped at zero going *down* only for display; the raw
       difference is kept too, because being 400 over matters and hiding it
       would be dishonest. */
    remaining: targets ? {
      kcal: Math.round(targets.kcal - totals.kcal),
      protein: Math.round(targets.protein - totals.protein),
      carbs: Math.round(targets.carbs - totals.carbs),
      fat: Math.round(targets.fat - totals.fat),
      fibre: Math.round(targets.fibre - totals.fibre),
    } : null,
    trend: await weightSeries(uid, daysAgo(date, 90)),
  });
});

export const PUT = withUser(async (uid, req) => {
  const b = await body(req);
  const date = isoDate(b.date);

  const patch: Record<string, unknown> = {};
  if ("weight_kg" in b) patch.weight_kg = num(b.weight_kg, 25, 400);
  if ("steps" in b) patch.steps = num(b.steps, 0, 200_000);
  if ("sleep_hours" in b) patch.sleep_hours = num(b.sleep_hours, 0, 24);
  if ("water_ml" in b) patch.water_ml = num(b.water_ml, 0, 20_000) ?? 0;
  if ("mood" in b) patch.mood = num(b.mood, 1, 5);
  if ("note" in b) patch.note = str(b.note, 500);
  if ("rest_day" in b) patch.rest_day = isBool(b.rest_day);
  if ("cheat_day" in b) patch.cheat_day = isBool(b.cheat_day);

  return ok({ day: await upsertDay(uid, date, patch) });
});
