import { withUser, ok, fail, body, num, str, oneOf } from "@/lib/api";
import { getProfile, upsertProfile, profileFor, latestWeight } from "@/lib/db";
import { dailyTargets } from "@/lib/fitness/energy";
import { project } from "@/lib/fitness/projection";

/**
 * The profile, plus everything computed from it.
 *
 * Targets are returned alongside the stored fields rather than being
 * recomputed in the browser, so there is exactly one implementation of the
 * equations and the web, iOS and Android apps cannot drift apart.
 */
export const GET = withUser(async (uid) => {
  const stored = await getProfile(uid);
  const profile = await profileFor(uid);

  if (!profile) {
    return ok({
      profile: stored,
      complete: false,
      weightKg: await latestWeight(uid),
      targets: null,
      projection: null,
    });
  }

  const targets = dailyTargets(profile);

  // Honour a manual calorie override when one is set: the projection should
  // describe what they are actually going to do, not what we suggested.
  const intake = stored?.kcal_override ?? targets.kcal;

  return ok({
    profile: stored,
    complete: true,
    weightKg: profile.weightKg,
    targets: {
      ...targets,
      kcal: stored?.kcal_override ?? targets.kcal,
      protein: stored?.protein_override ?? targets.protein,
      carbs: stored?.carbs_override ?? targets.carbs,
      fat: stored?.fat_override ?? targets.fat,
      overridden: stored?.kcal_override != null,
    },
    projection: project(profile, intake),
  });
});

const ACTIVITY = ["sedentary", "light", "moderate", "active", "very_active"];
const GOAL = ["lose", "maintain", "gain"];
const SEX = ["male", "female"];

export const PUT = withUser(async (uid, req) => {
  const b = await body(req);
  const patch = {};

  if ("display_name" in b) patch.display_name = str(b.display_name, 80);
  if ("email" in b) patch.email = str(b.email, 200);
  if ("sex" in b) patch.sex = oneOf(b.sex, SEX);
  if ("height_cm" in b) patch.height_cm = num(b.height_cm, 80, 260);
  if ("activity" in b) patch.activity = oneOf(b.activity, ACTIVITY) ?? "sedentary";
  if ("goal" in b) patch.goal = oneOf(b.goal, GOAL) ?? "maintain";
  if ("target_weight_kg" in b) patch.target_weight_kg = num(b.target_weight_kg, 25, 400);
  if ("training_days" in b) patch.training_days = num(b.training_days, 0, 7) ?? 3;
  if ("split" in b) patch.split = str(b.split, 40);
  if ("timezone" in b) patch.timezone = str(b.timezone, 60) ?? "Asia/Kolkata";
  if ("units" in b) patch.units = oneOf(b.units, ["metric", "imperial"]) ?? "metric";

  /* Birth date rather than age, so the number never goes stale. Rejecting
     under-13s here is the only place it can be enforced. */
  if ("birth_date" in b) {
    const d = str(b.birth_date, 10);
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const years = (Date.now() - new Date(d).getTime()) / 31_557_600_000;
      if (years < 13) return fail("You must be at least 13 to use Macro.");
      if (years > 100) return fail("Check that date of birth.");
      patch.birth_date = d;
    }
  }

  // Overrides: an explicit null clears them and hands control back.
  if ("kcal_override" in b) {
    patch.kcal_override = b.kcal_override === null ? null : num(b.kcal_override, 800, 8000);
  }
  for (const k of ["protein_override", "carbs_override", "fat_override"]) {
    if (k in b) patch[k] = b[k] === null ? null : num(b[k], 0, 1000);
  }

  if ("onboarded" in b && b.onboarded) patch.onboarded_at = new Date().toISOString();

  const saved = await upsertProfile(uid, patch);
  return ok({ profile: saved });
});
