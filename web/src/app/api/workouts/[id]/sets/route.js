import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { addSet, deleteSet, findExercise, getWorkout, lastSetsFor } from "@/lib/db";
import { e1rm, nextPrescription } from "@/lib/fitness/training";

/**
 * Log one set.
 *
 * Sets are posted as they happen rather than as a finished session, so the
 * app is usable standing at the rack — and so a session that gets abandoned
 * halfway still records the work that was done.
 */
export async function POST(req, ctx) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const uid = auth.user.uid;

  const { id: workoutId } = await ctx.params;
  const b = await req.json().catch(() => ({}));

  const exerciseId = typeof b.exercise_id === "string" ? b.exercise_id : "";
  // Resolves your own movements too, not just the built-in library.
  const ex = await findExercise(uid, exerciseId);
  if (!ex) return NextResponse.json({ error: "Unknown exercise." }, { status: 400 });

  const reps = clampInt(b.reps, 0, 500);
  if (reps == null) return NextResponse.json({ error: "How many reps?" }, { status: 400 });

  /* Absent and invalid are not the same thing. A missing weight is a
     bodyweight set and means zero; a weight of -60 is a typo, and quietly
     recording it as a 0 kg set writes a lie into the training history that
     nothing downstream can tell from a real one. */
  const weight = b.weight_kg == null || b.weight_kg === ""
    ? 0
    : clampNum(b.weight_kg, 0, 1000);
  if (weight == null) {
    return NextResponse.json(
      { error: "Weight has to be between 0 and 1000 kg." }, { status: 400 },
    );
  }

  for (const [field, value, hi] of [["rir", b.rir, 10], ["seconds", b.seconds, 3600]]) {
    if (value != null && value !== "" && clampInt(value, 0, hi) == null) {
      return NextResponse.json({ error: `That ${field} is not a number I can use.` }, { status: 400 });
    }
  }

  const workout = await getWorkout(uid, workoutId);
  if (!workout) return NextResponse.json({ error: "No such session." }, { status: 404 });

  // Next index in this exercise's run within this session.
  const existing = (workout.sets ?? []).filter((s) => s.exercise_id === exerciseId);

  try {
    const set = await addSet(uid, workoutId, {
      uid,
      exercise_id: exerciseId,
      exercise_name: ex.name,
      set_index: existing.length + 1,
      weight_kg: weight,
      reps,
      rir: clampInt(b.rir, 0, 10),
      seconds: clampInt(b.seconds, 0, 3600),
      warmup: b.warmup === true,
    });

    return NextResponse.json({
      set,
      e1rm: e1rm(weight, reps) || null,
      // What to aim for next session, updated the moment the set lands.
      next: nextPrescription(ex, await lastSetsFor(uid, exerciseId)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not save that set." },
      { status: 400 },
    );
  }
}

export async function DELETE(req) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const id = new URL(req.url).searchParams.get("set");
  if (!id) return NextResponse.json({ error: "Which set?" }, { status: 400 });

  return (await deleteSet(auth.user.uid, id))
    ? NextResponse.json({ deleted: true })
    : NextResponse.json({ error: "That set is not there." }, { status: 404 });
}

function clampInt(v, lo, hi) {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
}
function clampNum(v, lo, hi) {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
}
