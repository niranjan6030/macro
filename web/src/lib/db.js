import "server-only";
import { getAdminSupabase } from "@/lib/supabase/server";
import { EMPTY, sum } from "@/lib/nutrition/types";
import {} from "@/lib/fitness/energy";
import { byId as byIdBuiltIn } from "@/lib/fitness/training";

/**
 * Every read and write, scoped by uid.
 *
 * Route handlers verify the Firebase session cookie and then call in here
 * with the uid they got back. Nothing in this file trusts a uid from a
 * request body — that is the one mistake that would turn a private diary
 * into a public one.
 */

export function db() {
  const client = getAdminSupabase();
  if (!client) throw new NotConfigured();
  return client;
}

export class NotConfigured extends Error {
  constructor() {
    super("Supabase is not configured on this deployment. See README, section 2.");
  }
}

export const dbConfigured = () => getAdminSupabase() !== null;

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/**
 * Validate a date the client sent, falling back to UTC today.
 *
 * The fallback is the dangerous half. A day boundary computed on the server
 * rolls over at UTC midnight, which is half past five in the morning in
 * India: everything logged between midnight and 05:30 IST belongs, as far as
 * this function is concerned, to yesterday. The client always sends its own
 * local date for reads and writes, so the diary itself is right — but
 * anything that asks the server what day it is, with nothing to validate,
 * gets the wrong answer for a quarter of the day.
 *
 * Use `todayFor(uid)` for that. This one is only for checking a date that
 * arrived in a request.
 */
export function isoDate(value, fallback = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return value;
  }
  return fallback.toISOString().slice(0, 10);
}

/** Today, on the wall clock of whoever this is — not the server's. */
export function todayIn(timeZone) {
  try {
    // en-CA formats as YYYY-MM-DD, which is the shape everything else uses.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch {
    // An unknown zone string should not take a route down with it.
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Today for one person, from the timezone their browser reported at setup.
 *
 * That column has been filled in since the first version and read by nothing,
 * which is why the server has been quietly using UTC all along.
 */
export async function todayFor(uid) {
  const profile = await getProfile(uid);
  return todayIn(profile?.timezone ?? "UTC");
}

export const daysAgo = (iso, n) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export async function getProfile(uid) {
  const { data } = await db().from("profiles").select("*").eq("uid", uid).maybeSingle();
  return data ?? null;
}

export async function upsertProfile(uid, patch) {
  // uid is never taken from the caller's payload.
  const { uid: _ignored, ...rest } = patch;
  void _ignored;

  const { data, error } = await db()
    .from("profiles")
    .upsert({ ...rest, uid, updated_at: new Date().toISOString() }, { onConflict: "uid" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * The profile in the shape the science layer wants.
 *
 * Weight is deliberately not stored on the profile — it is a measurement
 * that changes weekly, so it lives in `days` and the latest one is read
 * here. Age is derived from the birth date so it never goes stale.
 */
export async function profileFor(uid) {
  const stored = await getProfile(uid);
  if (!stored?.sex || !stored.height_cm || !stored.birth_date) return null;

  const weight = await latestWeight(uid);
  if (weight == null) return null;

  const bf = await latestBodyFat(uid);

  return {
    sex: stored.sex,
    age: ageFrom(stored.birth_date),
    heightCm: Number(stored.height_cm),
    weightKg: weight,
    activity: stored.activity,
    goal: stored.goal,
    bodyFatPct: bf,
    targetWeightKg: stored.target_weight_kg != null ? Number(stored.target_weight_kg) : null,
    trainingDaysPerWeek: stored.training_days,
  };
}

export function ageFrom(birthDate) {
  const b = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return Math.max(13, Math.min(age, 100));
}

/* ------------------------------------------------------------------ */
/* Days and weight                                                     */
/* ------------------------------------------------------------------ */

export async function getDay(uid, date) {
  const { data } = await db()
    .from("days")
    .select("*")
    .eq("uid", uid)
    .eq("on_date", date)
    .maybeSingle();
  return data ?? null;
}

export async function upsertDay(uid, date, patch) {
  const { uid: _u, on_date: _d, ...rest } = patch;
  void _u;
  void _d;
  const { data, error } = await db()
    .from("days")
    .upsert(
      { ...rest, uid, on_date: date, updated_at: new Date().toISOString() },
      { onConflict: "uid,on_date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function latestWeight(uid) {
  const { data } = await db()
    .from("days")
    .select("weight_kg")
    .eq("uid", uid)
    .not("weight_kg", "is", null)
    .order("on_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const w = data?.weight_kg;
  return w != null ? Number(w) : null;
}

export async function latestBodyFat(uid) {
  const { data } = await db()
    .from("measurements")
    .select("body_fat_pct")
    .eq("uid", uid)
    .not("body_fat_pct", "is", null)
    .order("on_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const v = data?.body_fat_pct;
  return v != null ? Number(v) : null;
}

/**
 * Bodyweight history, with a smoothed line alongside the raw one.
 *
 * Daily weight swings by a kilo or more on water and gut contents alone, so
 * the raw scale number is close to useless for judging a trend — people quit
 * over a 700 g rise that was yesterday's salt. The seven-day moving average
 * is the line that actually reflects fat mass, and it is what the UI plots.
 */
export async function weightSeries(uid, sinceDate) {
  const { data } = await db()
    .from("days")
    .select("on_date, weight_kg")
    .eq("uid", uid)
    .gte("on_date", sinceDate)
    .not("weight_kg", "is", null)
    .order("on_date", { ascending: true });

  const rows = (data ?? []).map((r) => ({ date: r.on_date, weightKg: Number(r.weight_kg) }));

  return rows.map((r, i) => {
    const window = rows.slice(Math.max(0, i - 6), i + 1);
    const trend = window.reduce((t, x) => t + x.weightKg, 0) / window.length;
    return { ...r, trendKg: Math.round(trend * 10) / 10 };
  });
}

/* ------------------------------------------------------------------ */
/* Diary                                                               */
/* ------------------------------------------------------------------ */

export async function listDiary(uid, date) {
  const { data } = await db()
    .from("diary_entries")
    .select("*")
    .eq("uid", uid)
    .eq("on_date", date)
    .order("logged_at", { ascending: true });
  return data ?? [];
}

export async function addDiaryEntry(uid, entry) {
  const { data, error } = await db()
    .from("diary_entries")
    .insert({ ...entry, uid })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Delete is scoped by uid as well as id, so an id alone is not enough. */
export async function deleteDiaryEntry(uid, id) {
  const { error, count } = await db()
    .from("diary_entries")
    .delete({ count: "exact" })
    .eq("uid", uid)
    .eq("id", id);
  return !error && (count ?? 0) > 0;
}

export const totalsOf = (entries) =>
  entries.length ? sum(entries.map((e) => e.nutrients)) : EMPTY;

/** Daily totals over a window, for the charts and the coach. */
export async function totalsSince(uid, sinceDate) {
  const { data } = await db()
    .from("daily_totals")
    .select("*")
    .eq("uid", uid)
    .gte("on_date", sinceDate)
    .order("on_date", { ascending: true });

  return (data ?? []).map((r) => ({
    date: r.on_date,
    kcal: Number(r.kcal ?? 0),
    protein: Number(r.protein ?? 0),
    carbs: Number(r.carbs ?? 0),
    fat: Number(r.fat ?? 0),
    fibre: Number(r.fibre ?? 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Training                                                            */
/* ------------------------------------------------------------------ */

export async function listWorkouts(uid, sinceDate) {
  const { data } = await db()
    .from("workouts")
    .select("*, sets:workout_sets(*)")
    .eq("uid", uid)
    .gte("on_date", sinceDate)
    .order("on_date", { ascending: false });
  return data ?? [];
}

export async function getWorkout(uid, id) {
  const { data } = await db()
    .from("workouts")
    .select("*, sets:workout_sets(*)")
    .eq("uid", uid)
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}

export async function createWorkout(uid, on_date, name, split) {
  const { data, error } = await db()
    .from("workouts")
    .insert({ uid, on_date, name, split, started_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function addSet(uid, workoutId, set) {
  // Confirm the workout is theirs before writing a set into it.
  const owned = await getWorkout(uid, workoutId);
  if (!owned) throw new Error("No such workout.");

  const { data, error } = await db()
    .from("workout_sets")
    .insert({ ...set, uid, workout_id: workoutId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSet(uid, id) {
  const { error, count } = await db()
    .from("workout_sets")
    .delete({ count: "exact" })
    .eq("uid", uid)
    .eq("id", id);
  return !error && (count ?? 0) > 0;
}

/**
 * The most recent working sets for an exercise — what the progression
 * engine reads to decide what to prescribe next.
 */
export async function lastSetsFor(uid, exerciseId) {
  const { data } = await db()
    .from("workout_sets")
    .select("workout_id, weight_kg, reps, rir, set_index, logged_at")
    .eq("uid", uid)
    .eq("exercise_id", exerciseId)
    .eq("warmup", false)
    .order("logged_at", { ascending: false })
    .limit(12);

  const rows = data ?? [];

  if (!rows.length) return [];

  // Only the latest session, in the order the sets were performed.
  const latest = rows[0].workout_id;
  return rows
    .filter((r) => r.workout_id === latest)
    .sort((a, b) => a.set_index - b.set_index)
    .map((r) => ({ weightKg: Number(r.weight_kg), reps: r.reps, rir: r.rir }));
}

/* ------------------------------------------------------------------ */
/* Progress photos and measurements                                    */
/* ------------------------------------------------------------------ */

const PHOTO_COLS = "id, on_date, pose, path, iv, expires_at, purged_at, weight_kg, note";

export async function listPhotos(uid) {
  const { data } = await db()
    .from("progress_photos")
    .select(PHOTO_COLS)
    .eq("uid", uid)
    .order("on_date", { ascending: true });
  return data ?? [];
}

/**
 * A short-lived signed URL for a private photo.
 *
 * Ten minutes is long enough to load a comparison page and short enough
 * that a copied URL is useless by the time it is shared.
 */
export async function signPhoto(path, seconds = 600) {
  const { data } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export const PHOTO_BUCKET = "progress";

/**
 * Store an already-encrypted photo.
 *
 * `bytes` is ciphertext. Nothing on this side has the key, so the extension
 * is `.bin` and the content type is octet-stream — calling it a JPEG would
 * imply someone here could open it. What is stored in plain columns is the
 * date, the pose and the weight that day: enough to draw the progress chart
 * after the image itself has expired, and not enough to identify anyone.
 */
export async function savePhoto(uid, date, pose, bytes, iv) {
  // Path is namespaced by uid so one person's photos can never collide with
  // another's, even before the row is written.
  const path = `${uid}/${date}-${pose}-${crypto.randomUUID().slice(0, 8)}.bin`;

  const { error: upErr } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
  if (upErr) throw new Error(upErr.message);

  const [weight, keep] = await Promise.all([latestWeight(uid), retentionDays(uid)]);

  const { data, error } = await db()
    .from("progress_photos")
    .insert({
      uid,
      on_date: date,
      pose,
      path,
      iv,
      weight_kg: weight,
      expires_at: addDays(date, keep),
    })
    .select(PHOTO_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/* --------------------------------------------------------------------- */
/* The vault                                                              */
/*                                                                        */
/* Salt and verifier only. Neither is a key, and neither gets anyone any  */
/* closer to reading a photo — see lib/vault.js for why that is the whole */
/* point.                                                                 */
/* --------------------------------------------------------------------- */

export async function getVault(uid) {
  const { data } = await db()
    .from("photo_vault")
    .select("salt, verifier, retention_days")
    .eq("uid", uid)
    .maybeSingle();
  return data ?? null;
}

export async function createVault(uid, salt, verifier, retentionDays) {
  const { data } = await db()
    .from("photo_vault")
    .insert({ uid, salt, verifier, retention_days: retentionDays })
    .select("salt, verifier, retention_days")
    .single();
  return data ?? null;
}

export async function setRetention(uid, days) {
  const { error } = await db().from("photo_vault").update({ retention_days: days }).eq("uid", uid);
  if (error) return false;

  // Re-date what is already stored, so the setting means what it says rather
  // than applying only to photos taken after it was changed. Shortening the
  // window can move an expiry into the past; the next sweep collects those.
  const { data } = await db()
    .from("progress_photos")
    .select("id, on_date")
    .eq("uid", uid)
    .not("path", "is", null);

  await Promise.all(
    (data ?? []).map((r) =>
      db()
        .from("progress_photos")
        .update({ expires_at: addDays(r.on_date, days) })
        .eq("id", r.id),
    ),
  );
  return true;
}

const retentionDays = async (uid) => (await getVault(uid))?.retention_days ?? 180;

/**
 * Delete photo bytes that have outlived their retention.
 *
 * The rows stay. A progress chart made of dates and weights is worth keeping
 * for years and costs almost nothing; the images behind it are the expensive
 * part and the part nobody looks at twice.
 */
export async function purgeExpiredPhotos(limit = 500) {
  const today = isoDate(null);
  const { data } = await db()
    .from("progress_photos")
    .select("id, path")
    .not("path", "is", null)
    .lte("expires_at", today)
    .limit(limit);

  const rows = data ?? [];
  if (!rows.length) return 0;

  await db()
    .storage.from(PHOTO_BUCKET)
    .remove(rows.map((r) => r.path));
  await db()
    .from("progress_photos")
    .update({ path: null, iv: null, purged_at: new Date().toISOString() })
    .in(
      "id",
      rows.map((r) => r.id),
    );

  return rows.length;
}

export async function deletePhoto(uid, id) {
  const { data } = await db()
    .from("progress_photos")
    .select("path")
    .eq("uid", uid)
    .eq("id", id)
    .maybeSingle();
  const path = data?.path;
  if (!path) return false;

  await db().storage.from(PHOTO_BUCKET).remove([path]);
  const { error } = await db().from("progress_photos").delete().eq("uid", uid).eq("id", id);
  return !error;
}

export async function listMeasurements(uid) {
  const { data } = await db()
    .from("measurements")
    .select("*")
    .eq("uid", uid)
    .order("on_date", { ascending: true });
  return data ?? [];
}

export async function upsertMeasurement(uid, date, patch) {
  const { id: _i, on_date: _d, ...rest } = patch;
  void _i;
  void _d;
  const { data, error } = await db()
    .from("measurements")
    .upsert({ ...rest, uid, on_date: date }, { onConflict: "uid,on_date" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// -----------------------------------------------------------------------
// Exercises someone added themselves
//
// These are returned in the same shape as the built-in library so the
// progression engine, the volume counters and the picker cannot tell the
// difference. The `custom:` id prefix is the only tell, and it exists so a
// workout set can point at one without colliding with a library id.
// -----------------------------------------------------------------------

export const asExercise = (r) => ({
  id: `custom:${r.id}`,
  name: r.name,
  primary: r.primary_muscle,
  secondary: [],
  equipment: r.equipment,
  // Someone adding their own movement is nearly always adding an accessory.
  // Guessing "compound" would inflate their volume numbers.
  compound: false,
  repRange: [r.rep_low, r.rep_high],
  cue: r.note ?? "Your own movement.",
});

export async function listCustomExercises(uid) {
  const { data } = await db()
    .from("custom_exercises")
    .select("id, name, primary_muscle, equipment, rep_low, rep_high, note")
    .eq("uid", uid)
    .order("name");
  return (data ?? []).map(asExercise);
}

export async function addCustomExercise(uid, fields) {
  const { data, error } = await db()
    .from("custom_exercises")
    .insert({ uid, ...fields })
    .select("id, name, primary_muscle, equipment, rep_low, rep_high, note")
    .single();
  // A duplicate name is the one failure worth distinguishing, and the caller
  // turns a null into a readable message rather than a 500.
  if (error || !data) return null;
  return asExercise(data);
}

/**
 * One exercise by id, built-in or your own.
 *
 * The `custom:` prefix is the whole difference. Anything logging a set has
 * to come through here rather than the library's `byId`, which knows only
 * the sixty-five that ship with the app and answers null for everything a
 * person added themselves.
 */
export async function findExercise(uid, id) {
  if (!id.startsWith("custom:")) return byIdBuiltIn(id);

  const { data } = await db()
    .from("custom_exercises")
    .select("id, name, primary_muscle, equipment, rep_low, rep_high, note")
    .eq("uid", uid).eq("id", id.slice("custom:".length)).maybeSingle();
  return data ? asExercise(data) : null;
}

export async function deleteCustomExercise(uid, id) {
  const { error } = await db().from("custom_exercises").delete().eq("uid", uid).eq("id", id);
  return !error;
}
