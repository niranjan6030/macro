import { withUser, ok, body, num } from "@/lib/api";
import { getProfile, listMeasurements, upsertMeasurement, isoDate } from "@/lib/db";

/**
 * Tape measurements, and body fat derived from them.
 *
 * A tape is the cheapest honest measure of body composition there is —
 * better than a bathroom scale's bioimpedance reading, which swings with
 * hydration — so the numbers here feed the whole energy model. Where the
 * required girths are present, the US Navy circumference method is used;
 * where they are not, the field is simply left empty rather than filled
 * with a guess.
 */
export const GET = withUser(async (uid) => ok({
  measurements: await listMeasurements(uid),
}));

export const POST = withUser(async (uid, req) => {
  const b = await body(req);
  const date = isoDate(b.date);

  const patch: Record<string, number | null> = {};
  for (const k of ["neck_cm", "chest_cm", "waist_cm", "hips_cm", "thigh_cm", "arm_cm"] as const) {
    if (k in b) patch[k] = num(b[k], 10, 250);
  }
  if ("body_fat_pct" in b) patch.body_fat_pct = num(b.body_fat_pct, 2, 70);

  // Derive body fat only when it was not measured directly.
  if (patch.body_fat_pct == null) {
    const profile = await getProfile(uid);
    const bf = navyBodyFat({
      sex: profile?.sex ?? null,
      heightCm: profile?.height_cm != null ? Number(profile.height_cm) : null,
      neck: patch.neck_cm ?? null,
      waist: patch.waist_cm ?? null,
      hips: patch.hips_cm ?? null,
    });
    if (bf != null) patch.body_fat_pct = bf;
  }

  const saved = await upsertMeasurement(uid, date, patch);
  return ok({ measurement: saved, derived: patch.body_fat_pct != null && !("body_fat_pct" in b) });
});

/**
 * US Navy circumference method.
 *
 * Men need neck and waist; women need neck, waist and hips. Accurate to
 * roughly ±3 percentage points against a DEXA scan, which is worse than a
 * laboratory and far better than nothing.
 */
function navyBodyFat(m: {
  sex: string | null; heightCm: number | null;
  neck: number | null; waist: number | null; hips: number | null;
}): number | null {
  const { sex, heightCm, neck, waist, hips } = m;
  if (!sex || !heightCm || !neck || !waist) return null;
  if (sex === "female" && !hips) return null;

  const log10 = Math.log10;
  const pct = sex === "male"
    ? 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(heightCm)) - 450
    : 495 / (1.29579 - 0.35004 * log10(waist + hips! - neck) + 0.22100 * log10(heightCm)) - 450;

  if (!Number.isFinite(pct) || pct < 2 || pct > 70) return null;
  return Math.round(pct * 10) / 10;
}
