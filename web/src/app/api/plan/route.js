import { withUser, ok } from "@/lib/api";
import { getDay, getProfile, isoDate, lastSetsFor } from "@/lib/db";
import {
  SPLITS,
  byId,
  nextPrescription,
  splitFor,
  weekPlan,
  weeklyVolume,
} from "@/lib/fitness/training";

/**
 * Today's session, prescribed from what they actually lifted last time.
 *
 * The weights are not repeated from a template — each exercise is run
 * through the progression engine against that person's last session for it,
 * so "3 sets of 12" becomes "62.5 kg, and here is why".
 */
export const GET = withUser(async (uid, req) => {
  const url = new URL(req.url);
  const date = isoDate(url.searchParams.get("date"));

  const [profile, day] = await Promise.all([getProfile(uid), getDay(uid, date)]);
  const days = profile?.training_days ?? 3;
  const split = profile?.split in SPLITS ? profile.split : splitFor(days);

  const week = weekPlan(days, split);
  // Monday-first, matching weekPlan.
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const session = week[dow];

  const rest = day?.rest_day === true;

  if (rest || !session) {
    return ok({
      date,
      split,
      splitLabel: SPLITS[split].label,
      restDay: true,
      session: null,
      reason: rest
        ? "You marked today as a rest day."
        : "Rest day — this is where the training you already did turns into muscle.",
      week: week.map((s) => s?.name ?? null),
      weeklyVolume: weeklyVolume(SPLITS[split].sessions),
    });
  }

  // One progression lookup per exercise; independent, so run them together.
  const exercises = await Promise.all(
    session.exerciseIds.map(async (id) => {
      const ex = byId(id);
      if (!ex) return null;
      const last = await lastSetsFor(uid, id);
      return {
        ...ex,
        last: last.length ? last : null,
        prescription: nextPrescription(ex, last.length ? last : null),
      };
    }),
  );

  return ok({
    date,
    split,
    splitLabel: SPLITS[split].label,
    blurb: SPLITS[split].blurb,
    restDay: false,
    session: { name: session.name, focus: session.focus },
    exercises: exercises.filter(Boolean),
    week: week.map((s) => s?.name ?? null),
    weeklyVolume: weeklyVolume(SPLITS[split].sessions),
  });
});
