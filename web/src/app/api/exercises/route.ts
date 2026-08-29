import { withUser, ok, fail, body, str, num, oneOf } from "@/lib/api";
import { listCustomExercises, addCustomExercise, deleteCustomExercise } from "@/lib/db";
import { MUSCLE_LABEL, EQUIPMENT_LABEL, type Muscle, type Equipment } from "@/lib/fitness/training";

const MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

export const GET = withUser(async (uid) => ok({ exercises: await listCustomExercises(uid) }));

export const POST = withUser(async (uid, req) => {
  const b = await body(req);

  const name = str(b.name, 60);
  if (!name) return fail("Give the movement a name.");

  const muscle = oneOf(b.primary, MUSCLES);
  if (!muscle) return fail("Pick which muscle it works.");

  const equipment = oneOf(b.equipment, EQUIPMENT) ?? "bodyweight";

  // Reps are a range, so an inverted one is a typo rather than an intent.
  // Swapping is friendlier than refusing.
  let low = num(b.repLow, 1, 100) ?? 8;
  let high = num(b.repHigh, 1, 200) ?? 12;
  if (low > high) [low, high] = [high, low];

  const exercise = await addCustomExercise(uid, {
    name, primary_muscle: muscle, equipment,
    rep_low: Math.round(low), rep_high: Math.round(high),
    note: str(b.note, 200),
  });
  if (!exercise) return fail(`You already have a movement called "${name}".`, 409);

  return ok({ exercise });
});

export const DELETE = withUser(async (uid, req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Which one?");
  return (await deleteCustomExercise(uid, id))
    ? ok({ deleted: true })
    : fail("Could not remove that.", 404);
});
