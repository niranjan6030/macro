/**
 * Training: the exercise library, the split templates, and progression.
 *
 * The programme is generated rather than fixed, because "3 sets of 12" is not
 * a plan — it is a placeholder that ignores what the person did last week.
 * What makes a programme work is progressive overload, so the interesting
 * logic here is `nextPrescription`: it reads the last session for an exercise
 * and decides whether to add reps, add weight, hold, or back off.
 *
 *   Epley (1985)                            — one-rep-max estimate
 *   Schoenfeld BJ et al. (2017) J Sports Sci — 10+ hard sets per muscle/week
 *   Helms ER et al. (2016) Strength Cond J   — RIR-based autoregulation
 */

export const EXERCISES = [
  // Chest
  {
    id: "bench",
    name: "Barbell bench press",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    equipment: "barbell",
    compound: true,
    repRange: [5, 8],
    cue: "Shoulder blades pinned back, bar to the lower chest, elbows about 45°.",
  },
  {
    id: "db-press",
    name: "Dumbbell bench press",
    primary: "chest",
    secondary: ["triceps", "shoulders"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Lower until the dumbbells are level with your chest, then drive up and slightly together.",
  },
  {
    id: "incline-db",
    name: "Incline dumbbell press",
    primary: "chest",
    secondary: ["shoulders", "triceps"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Bench at 30°. Any steeper and it becomes a shoulder press.",
  },
  {
    id: "fly",
    name: "Cable fly",
    primary: "chest",
    secondary: [],
    equipment: "cable",
    compound: false,
    repRange: [12, 15],
    cue: "Soft elbows, fixed angle. Think of hugging, not pressing.",
  },
  {
    id: "pushup",
    name: "Push-up",
    primary: "chest",
    secondary: ["triceps", "core"],
    equipment: "bodyweight",
    compound: true,
    repRange: [10, 20],
    cue: "Straight line from head to heels. Chest to the floor, not just the nose.",
  },
  // Back
  {
    id: "deadlift",
    name: "Barbell deadlift",
    primary: "back",
    secondary: ["hamstrings", "glutes", "core"],
    equipment: "barbell",
    compound: true,
    repRange: [3, 6],
    cue: "Bar over mid-foot, lats tight, push the floor away. Stop the set when the back rounds.",
  },
  {
    id: "row",
    name: "Barbell row",
    primary: "back",
    secondary: ["biceps"],
    equipment: "barbell",
    compound: true,
    repRange: [6, 10],
    cue: "Torso around 45°, pull to the navel, no heaving with the lower back.",
  },
  {
    id: "pullup",
    name: "Pull-up",
    primary: "back",
    secondary: ["biceps"],
    equipment: "bodyweight",
    compound: true,
    repRange: [5, 12],
    cue: "Full hang at the bottom, chin clearly over the bar at the top.",
  },
  {
    id: "lat-pulldown",
    name: "Lat pulldown",
    primary: "back",
    secondary: ["biceps"],
    equipment: "cable",
    compound: true,
    repRange: [8, 12],
    cue: "Drive the elbows down and back. The bar comes to the collarbone.",
  },
  {
    id: "cable-row",
    name: "Seated cable row",
    primary: "back",
    secondary: ["biceps"],
    equipment: "cable",
    compound: true,
    repRange: [10, 15],
    cue: "Chest up, no rocking. Squeeze at the ribs for a beat.",
  },
  // Shoulders
  {
    id: "ohp",
    name: "Overhead press",
    primary: "shoulders",
    secondary: ["triceps", "core"],
    equipment: "barbell",
    compound: true,
    repRange: [5, 8],
    cue: "Squeeze the glutes, move the head back as the bar passes, finish with the bar over the ears.",
  },
  {
    id: "db-shoulder",
    name: "Dumbbell shoulder press",
    primary: "shoulders",
    secondary: ["triceps"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Stop just short of locking out to keep the tension on the delts.",
  },
  {
    id: "lateral",
    name: "Lateral raise",
    primary: "shoulders",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [12, 20],
    cue: "Light weight, lead with the elbows, stop at shoulder height. Do not swing.",
  },
  {
    id: "face-pull",
    name: "Face pull",
    primary: "shoulders",
    secondary: ["back"],
    equipment: "cable",
    compound: false,
    repRange: [15, 20],
    cue: "Pull to the forehead, rotate outwards. The best insurance a bench press has.",
  },
  // Legs
  {
    id: "squat",
    name: "Barbell back squat",
    primary: "quads",
    secondary: ["glutes", "hamstrings", "core"],
    equipment: "barbell",
    compound: true,
    repRange: [5, 8],
    cue: "Brace before you descend, knees tracking over the toes, hips to at least parallel.",
  },
  {
    id: "front-squat",
    name: "Front squat",
    primary: "quads",
    secondary: ["core", "glutes"],
    equipment: "barbell",
    compound: true,
    repRange: [5, 8],
    cue: "Elbows high throughout. The moment they drop, the bar follows.",
  },
  {
    id: "leg-press",
    name: "Leg press",
    primary: "quads",
    secondary: ["glutes"],
    equipment: "machine",
    compound: true,
    repRange: [10, 15],
    cue: "Do not let the lower back lift off the pad at the bottom.",
  },
  {
    id: "rdl",
    name: "Romanian deadlift",
    primary: "hamstrings",
    secondary: ["glutes", "back"],
    equipment: "barbell",
    compound: true,
    repRange: [8, 12],
    cue: "Push the hips back with a flat back. Stop where the stretch stops, not where the floor is.",
  },
  {
    id: "lunge",
    name: "Walking lunge",
    primary: "quads",
    secondary: ["glutes", "hamstrings"],
    equipment: "dumbbell",
    compound: true,
    repRange: [10, 15],
    cue: "Long stride for glutes, short stride for quads. Per leg.",
  },
  {
    id: "leg-curl",
    name: "Lying leg curl",
    primary: "hamstrings",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [10, 15],
    cue: "Slow on the way back — that is where hamstrings actually grow.",
  },
  {
    id: "hip-thrust",
    name: "Hip thrust",
    primary: "glutes",
    secondary: ["hamstrings"],
    equipment: "barbell",
    compound: true,
    repRange: [8, 12],
    cue: "Chin tucked, ribs down, full lockout with a hard squeeze at the top.",
  },
  {
    id: "calf-raise",
    name: "Standing calf raise",
    primary: "calves",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [12, 20],
    cue: "Full stretch at the bottom, pause at the top. Calves need the range.",
  },
  // Arms
  {
    id: "curl",
    name: "Barbell curl",
    primary: "biceps",
    secondary: [],
    equipment: "barbell",
    compound: false,
    repRange: [8, 12],
    cue: "Elbows stay at your sides. If the shoulders move, it is too heavy.",
  },
  {
    id: "hammer",
    name: "Hammer curl",
    primary: "biceps",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [10, 15],
    cue: "Neutral grip. This is the one that builds the thickness of the arm.",
  },
  {
    id: "skull",
    name: "Lying triceps extension",
    primary: "triceps",
    secondary: [],
    equipment: "barbell",
    compound: false,
    repRange: [10, 15],
    cue: "Upper arms stay still. Lower to the forehead, not the chest.",
  },
  {
    id: "pushdown",
    name: "Cable triceps pushdown",
    primary: "triceps",
    secondary: [],
    equipment: "cable",
    compound: false,
    repRange: [12, 15],
    cue: "Lock the elbows to your ribs and open only from there.",
  },
  {
    id: "dip",
    name: "Dip",
    primary: "triceps",
    secondary: ["chest", "shoulders"],
    equipment: "bodyweight",
    compound: true,
    repRange: [6, 12],
    cue: "Upright for triceps, leaning forward for chest. Do not go below a painful shoulder stretch.",
  },
  // Core
  {
    id: "plank",
    name: "Plank",
    primary: "core",
    secondary: [],
    equipment: "bodyweight",
    compound: false,
    repRange: [30, 90],
    cue: "Seconds, not reps. Squeeze the glutes — a sagging hip makes it a rest, not a set.",
  },
  {
    id: "hanging-leg",
    name: "Hanging leg raise",
    primary: "core",
    secondary: [],
    equipment: "bodyweight",
    compound: false,
    repRange: [8, 15],
    cue: "Curl the pelvis up. Swinging the legs works the hip flexors instead.",
  },
  {
    id: "cable-crunch",
    name: "Cable crunch",
    primary: "core",
    secondary: [],
    equipment: "cable",
    compound: false,
    repRange: [12, 20],
    cue: "Round the spine down towards the knees. Hips do not move.",
  },

  /* Everything below is what people actually reach for on a real gym floor.
     The set above is enough to *build* a programme; this is enough to *log*
     one, which is a different and larger requirement. */
  {
    id: "incline-bench",
    name: "Incline barbell press",
    primary: "chest",
    secondary: ["shoulders", "triceps"],
    equipment: "barbell",
    compound: true,
    repRange: [6, 10],
    cue: "Bench at 30°. Bar to just below the collarbone.",
  },
  {
    id: "decline-press",
    name: "Decline press",
    primary: "chest",
    secondary: ["triceps"],
    equipment: "barbell",
    compound: true,
    repRange: [8, 12],
    cue: "Shorter range, heavier load. Easy on the shoulders.",
  },
  {
    id: "chest-press-machine",
    name: "Chest press machine",
    primary: "chest",
    secondary: ["triceps"],
    equipment: "machine",
    compound: true,
    repRange: [10, 15],
    cue: "Handles level with the mid-chest, not the collarbone.",
  },
  {
    id: "pec-deck",
    name: "Pec deck",
    primary: "chest",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [12, 15],
    cue: "Squeeze for a beat where the hands meet.",
  },
  {
    id: "incline-fly",
    name: "Incline dumbbell fly",
    primary: "chest",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [12, 15],
    cue: "Soft elbows, wide arc, stop at chest level.",
  },

  {
    id: "t-bar-row",
    name: "T-bar row",
    primary: "back",
    secondary: ["biceps"],
    equipment: "barbell",
    compound: true,
    repRange: [8, 12],
    cue: "Chest against the pad if there is one. No jerking.",
  },
  {
    id: "db-row",
    name: "Single-arm dumbbell row",
    primary: "back",
    secondary: ["biceps"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Pull to the hip, not the armpit. Let the shoulder stretch at the bottom.",
  },
  {
    id: "chinup",
    name: "Chin-up",
    primary: "back",
    secondary: ["biceps"],
    equipment: "bodyweight",
    compound: true,
    repRange: [5, 12],
    cue: "Underhand grip. More biceps than a pull-up, and usually a few more reps.",
  },
  {
    id: "pullover",
    name: "Dumbbell pullover",
    primary: "back",
    secondary: ["chest"],
    equipment: "dumbbell",
    compound: false,
    repRange: [10, 15],
    cue: "Hips low, stretch over the head, feel it through the ribs.",
  },
  {
    id: "shrug",
    name: "Shrug",
    primary: "back",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [12, 20],
    cue: "Straight up, pause at the top. Rolling the shoulders does nothing.",
  },
  {
    id: "rack-pull",
    name: "Rack pull",
    primary: "back",
    secondary: ["glutes"],
    equipment: "barbell",
    compound: true,
    repRange: [4, 8],
    cue: "From the knee. Heavier than a deadlift, less range.",
  },
  {
    id: "hyperextension",
    name: "Back extension",
    primary: "back",
    secondary: ["hamstrings", "glutes"],
    equipment: "bodyweight",
    compound: false,
    repRange: [12, 20],
    cue: "Stop level with the body. Arching past it does nothing good.",
  },

  {
    id: "arnold-press",
    name: "Arnold press",
    primary: "shoulders",
    secondary: ["triceps"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Rotate the palms out as you press. Slow.",
  },
  {
    id: "upright-row",
    name: "Upright row",
    primary: "shoulders",
    secondary: ["back"],
    equipment: "barbell",
    compound: false,
    repRange: [10, 15],
    cue: "Wide grip, elbows to shoulder height only. Narrow and high hurts shoulders.",
  },
  {
    id: "rear-delt-fly",
    name: "Rear delt fly",
    primary: "shoulders",
    secondary: ["back"],
    equipment: "dumbbell",
    compound: false,
    repRange: [15, 20],
    cue: "Bent over, thumbs down, lead with the elbows.",
  },
  {
    id: "cable-lateral",
    name: "Cable lateral raise",
    primary: "shoulders",
    secondary: [],
    equipment: "cable",
    compound: false,
    repRange: [12, 20],
    cue: "Constant tension the whole way. Better than dumbbells for this one.",
  },

  {
    id: "hack-squat",
    name: "Hack squat",
    primary: "quads",
    secondary: ["glutes"],
    equipment: "machine",
    compound: true,
    repRange: [8, 12],
    cue: "Feet lower on the plate for quads, higher for glutes.",
  },
  {
    id: "bulgarian",
    name: "Bulgarian split squat",
    primary: "quads",
    secondary: ["glutes"],
    equipment: "dumbbell",
    compound: true,
    repRange: [8, 12],
    cue: "Back foot elevated. Brutal, and the best single-leg movement there is.",
  },
  {
    id: "leg-extension",
    name: "Leg extension",
    primary: "quads",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [12, 20],
    cue: "Pause at the top. Do not swing the weight up.",
  },
  {
    id: "goblet-squat",
    name: "Goblet squat",
    primary: "quads",
    secondary: ["glutes", "core"],
    equipment: "dumbbell",
    compound: true,
    repRange: [10, 15],
    cue: "Dumbbell at the chest. The easiest squat to learn depth with.",
  },
  {
    id: "seated-leg-curl",
    name: "Seated leg curl",
    primary: "hamstrings",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [10, 15],
    cue: "More stretch than lying. Both are worth doing.",
  },
  {
    id: "good-morning",
    name: "Good morning",
    primary: "hamstrings",
    secondary: ["back", "glutes"],
    equipment: "barbell",
    compound: true,
    repRange: [8, 12],
    cue: "Light. Hinge, do not squat. Stop where the back would round.",
  },
  {
    id: "glute-bridge",
    name: "Glute bridge",
    primary: "glutes",
    secondary: ["hamstrings"],
    equipment: "bodyweight",
    compound: false,
    repRange: [15, 20],
    cue: "Squeeze hard at the top for a full second.",
  },
  {
    id: "seated-calf",
    name: "Seated calf raise",
    primary: "calves",
    secondary: [],
    equipment: "machine",
    compound: false,
    repRange: [15, 20],
    cue: "Hits the soleus, underneath the main calf. Higher reps.",
  },

  {
    id: "preacher-curl",
    name: "Preacher curl",
    primary: "biceps",
    secondary: [],
    equipment: "barbell",
    compound: false,
    repRange: [10, 15],
    cue: "No cheating possible, which is the point. Do not lock out hard at the bottom.",
  },
  {
    id: "incline-curl",
    name: "Incline dumbbell curl",
    primary: "biceps",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [10, 15],
    cue: "Arms behind the body. The best stretch a biceps gets.",
  },
  {
    id: "cable-curl",
    name: "Cable curl",
    primary: "biceps",
    secondary: [],
    equipment: "cable",
    compound: false,
    repRange: [12, 15],
    cue: "Tension all the way down, unlike a dumbbell.",
  },
  {
    id: "overhead-ext",
    name: "Overhead triceps extension",
    primary: "triceps",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [10, 15],
    cue: "Arms overhead stretches the long head. Where triceps size comes from.",
  },
  {
    id: "close-grip-bench",
    name: "Close-grip bench press",
    primary: "triceps",
    secondary: ["chest", "shoulders"],
    equipment: "barbell",
    compound: true,
    repRange: [6, 10],
    cue: "Shoulder width, not narrower. Elbows tucked.",
  },
  {
    id: "kickback",
    name: "Triceps kickback",
    primary: "triceps",
    secondary: [],
    equipment: "dumbbell",
    compound: false,
    repRange: [12, 20],
    cue: "Upper arm parallel to the floor and still. Light weight.",
  },

  {
    id: "russian-twist",
    name: "Russian twist",
    primary: "core",
    secondary: [],
    equipment: "bodyweight",
    compound: false,
    repRange: [15, 30],
    cue: "Rotate from the ribs, not the arms.",
  },
  {
    id: "ab-wheel",
    name: "Ab wheel rollout",
    primary: "core",
    secondary: ["shoulders"],
    equipment: "bodyweight",
    compound: false,
    repRange: [8, 15],
    cue: "Ribs down, no arch. Go only as far as you can come back from.",
  },
  {
    id: "side-plank",
    name: "Side plank",
    primary: "core",
    secondary: [],
    equipment: "bodyweight",
    compound: false,
    repRange: [20, 60],
    cue: "Seconds per side. Hips stacked and lifted.",
  },
  {
    id: "leg-raise",
    name: "Lying leg raise",
    primary: "core",
    secondary: [],
    equipment: "bodyweight",
    compound: false,
    repRange: [12, 20],
    cue: "Press the lower back into the floor the whole time.",
  },
  {
    id: "farmers-walk",
    name: "Farmer's walk",
    primary: "core",
    secondary: ["back", "calves"],
    equipment: "dumbbell",
    compound: true,
    repRange: [30, 60],
    cue: "Seconds. Heavy, tall, and do not let the shoulders round.",
  },
];

export const byId = (id) => EXERCISES.find((e) => e.id === id) ?? null;

export const MUSCLE_LABEL = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  biceps: "Biceps",
  triceps: "Triceps",
  calves: "Calves",
  core: "Core",
};

export const EQUIPMENT_LABEL = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
};

/** Every exercise for a muscle, compounds first — they carry the session. */
export function byMuscle(muscle) {
  return EXERCISES.filter((e) => e.primary === muscle).sort(
    (a, b) => Number(b.compound) - Number(a.compound),
  );
}

/** Free-text search across names, muscles and equipment. */
export function findExercises(query, limit = 24) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return EXERCISES.map((e) => {
    const name = e.name.toLowerCase();
    let score = 0;
    if (name === q) score = 100;
    else if (name.startsWith(q)) score = 70;
    else if (name.includes(q)) score = 45;
    else if (e.primary.includes(q) || e.equipment.includes(q)) score = 20;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}

/* ------------------------------------------------------------------ */
/* Splits                                                              */
/* ------------------------------------------------------------------ */

/*
 * Chosen by weekly frequency rather than offered as a menu.
 *
 * Three days is not enough to run push/pull/legs properly — each muscle
 * would be trained once a week, which is below the frequency the evidence
 * supports — so at three days the app builds full-body sessions instead,
 * even though PPL is what people ask for.
 */
export const SPLITS = {
  full_body: {
    label: "Full body",
    days: 3,
    blurb: "Everything, three times a week. The most efficient use of three days there is.",
    sessions: [
      {
        name: "Full body A",
        focus: ["quads", "chest", "back"],
        exerciseIds: ["squat", "bench", "row", "lateral", "plank"],
      },
      {
        name: "Full body B",
        focus: ["hamstrings", "back", "shoulders"],
        exerciseIds: ["rdl", "lat-pulldown", "ohp", "curl", "calf-raise"],
      },
      {
        name: "Full body C",
        focus: ["quads", "chest", "back"],
        exerciseIds: ["leg-press", "incline-db", "cable-row", "pushdown", "hanging-leg"],
      },
    ],
  },
  upper_lower: {
    label: "Upper / lower",
    days: 4,
    blurb: "Four days, each muscle twice a week. The best balance of frequency and recovery.",
    sessions: [
      {
        name: "Upper A",
        focus: ["chest", "back", "shoulders"],
        exerciseIds: ["bench", "row", "ohp", "lat-pulldown", "curl", "pushdown"],
      },
      {
        name: "Lower A",
        focus: ["quads", "hamstrings", "glutes"],
        exerciseIds: ["squat", "rdl", "leg-press", "calf-raise", "hanging-leg"],
      },
      {
        name: "Upper B",
        focus: ["chest", "back", "shoulders"],
        exerciseIds: ["incline-db", "pullup", "db-shoulder", "cable-row", "hammer", "skull"],
      },
      {
        name: "Lower B",
        focus: ["hamstrings", "glutes", "quads"],
        exerciseIds: ["deadlift", "lunge", "leg-curl", "hip-thrust", "plank"],
      },
    ],
  },
  push_pull_legs: {
    label: "Push / pull / legs",
    days: 6,
    blurb: "Six days, each muscle twice a week, with the most room for volume.",
    sessions: [
      {
        name: "Push A",
        focus: ["chest", "shoulders", "triceps"],
        exerciseIds: ["bench", "db-shoulder", "incline-db", "lateral", "pushdown"],
      },
      {
        name: "Pull A",
        focus: ["back", "biceps"],
        exerciseIds: ["deadlift", "pullup", "cable-row", "face-pull", "curl"],
      },
      {
        name: "Legs A",
        focus: ["quads", "hamstrings", "calves"],
        exerciseIds: ["squat", "rdl", "leg-press", "calf-raise", "plank"],
      },
      {
        name: "Push B",
        focus: ["chest", "shoulders", "triceps"],
        exerciseIds: ["ohp", "db-press", "fly", "lateral", "dip"],
      },
      {
        name: "Pull B",
        focus: ["back", "biceps"],
        exerciseIds: ["row", "lat-pulldown", "face-pull", "hammer", "hanging-leg"],
      },
      {
        name: "Legs B",
        focus: ["hamstrings", "glutes", "quads"],
        exerciseIds: ["front-squat", "hip-thrust", "leg-curl", "lunge", "calf-raise"],
      },
    ],
  },
  arnold: {
    label: "Chest+back / shoulders+arms / legs",
    days: 6,
    blurb: "Six days, antagonist pairings. Demanding, and best once you have a base.",
    sessions: [
      {
        name: "Chest & back",
        focus: ["chest", "back"],
        exerciseIds: ["bench", "row", "incline-db", "pullup", "fly"],
      },
      {
        name: "Shoulders & arms",
        focus: ["shoulders", "biceps", "triceps"],
        exerciseIds: ["ohp", "lateral", "face-pull", "curl", "skull"],
      },
      {
        name: "Legs",
        focus: ["quads", "hamstrings", "calves"],
        exerciseIds: ["squat", "rdl", "leg-press", "leg-curl", "calf-raise"],
      },
      {
        name: "Chest & back II",
        focus: ["chest", "back"],
        exerciseIds: ["db-press", "lat-pulldown", "dip", "cable-row", "fly"],
      },
      {
        name: "Shoulders & arms II",
        focus: ["shoulders", "biceps", "triceps"],
        exerciseIds: ["db-shoulder", "lateral", "hammer", "pushdown", "hanging-leg"],
      },
      {
        name: "Legs II",
        focus: ["hamstrings", "glutes", "quads"],
        exerciseIds: ["deadlift", "hip-thrust", "lunge", "leg-curl", "calf-raise"],
      },
    ],
  },
};

/** The split that suits this many training days. */
export function splitFor(daysPerWeek) {
  if (daysPerWeek <= 3) return "full_body";
  if (daysPerWeek <= 5) return "upper_lower";
  return "push_pull_legs";
}

/**
 * Lay the split across the week.
 *
 * Rest days are placed between the hardest sessions rather than being
 * swept to the weekend — back-to-back leg days is how people get hurt.
 */
export function weekPlan(daysPerWeek, split) {
  const name = split ?? splitFor(daysPerWeek);
  const def = SPLITS[name];
  const days = Math.max(1, Math.min(daysPerWeek, 7));

  // Monday-first. Even spacing of the training days across seven.
  const slots = Array(7).fill(null);
  const chosen = [];
  for (let i = 0; i < days; i++) chosen.push(Math.round((i * 7) / days));

  chosen.forEach((day, i) => {
    slots[Math.min(day, 6)] = def.sessions[i % def.sessions.length];
  });
  return slots;
}

/* ------------------------------------------------------------------ */
/* Progression                                                         */
/* ------------------------------------------------------------------ */

/** Estimated one-rep max (Epley). Reliable to about 10 reps, not beyond. */
export function e1rm(weightKg, reps) {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Total load moved. The number that has to go up over months. */
export const volume = (sets) => Math.round(sets.reduce((t, s) => t + s.weightKg * s.reps, 0));

/**
 * What to do this week, given what happened last week.
 *
 * Double progression: add reps within the range first, and only add weight
 * once the top of the range is reached across all sets. Adding weight every
 * session works for about a month and then stalls hard.
 *
 * `last` is the most recent session for this exercise, oldest set first.
 */
export function nextPrescription(ex, last) {
  const [lo, hi] = ex.repRange;

  if (!last?.length) {
    return {
      sets: ex.compound ? 3 : 3,
      reps: lo,
      weightKg: null,
      reason: `First time. Find a weight you could stop ${ex.compound ? "two" : "three"} reps short of, and log it.`,
    };
  }

  const sets = last.length;
  const working = last.filter((s) => s.reps > 0);
  const topWeight = Math.max(...working.map((s) => s.weightKg));
  const atTop = working.filter((s) => s.weightKg >= topWeight);
  const allHitTop = atTop.length >= sets - 1 && atTop.every((s) => s.reps >= hi);
  const anyFailedLow = working.some((s) => s.reps < lo);
  const avgRir = average(working.map((s) => s.rir ?? 2));

  // Everything at the top of the range: earn the weight jump.
  if (allHitTop) {
    // Upper body moves in smaller steps than lower body — the plates are the
    // same but the relative jump is much larger.
    const step = ex.compound
      ? ["quads", "hamstrings", "glutes", "back"].includes(ex.primary)
        ? 5
        : 2.5
      : 2.5;
    return {
      sets,
      reps: lo,
      weightKg: round(topWeight + step),
      reason: `You hit ${hi} on every set. Add ${step} kg and start again at ${lo} reps.`,
    };
  }

  // Failing to reach the bottom of the range: the weight is wrong.
  if (anyFailedLow) {
    const worst = Math.min(...working.map((s) => s.reps));
    if (worst < lo - 2) {
      return {
        sets,
        reps: lo,
        weightKg: round(topWeight * 0.9),
        reason: `${worst} reps is below the range. Drop 10% and rebuild — that is a stall, not a bad day.`,
      };
    }
    return {
      sets,
      reps: lo,
      weightKg: topWeight,
      reason: "Same weight again. Get every set to the bottom of the range before adding load.",
    };
  }

  // Leaving too much in the tank: the sets are not hard enough to count.
  if (avgRir >= 4) {
    return {
      sets,
      reps: hi,
      weightKg: round(topWeight * 1.05),
      reason: `You had ${Math.round(avgRir)} reps left over. Add about 5% — sets need to finish within two of failure.`,
    };
  }

  const best = Math.max(...working.map((s) => s.reps));
  return {
    sets,
    reps: Math.min(best + 1, hi),
    weightKg: topWeight,
    reason: `Same weight, one more rep than last time (${best} → ${Math.min(best + 1, hi)}).`,
  };
}

/**
 * Weekly hard sets per muscle — the single best predictor of whether a
 * programme grows anything. Below about 10 is maintenance; above about 20
 * is usually more than can be recovered from.
 */
export function weeklyVolume(sessions, setsPerExercise = 3) {
  const counts = {};
  for (const s of sessions) {
    for (const id of s.exerciseIds) {
      const ex = byId(id);
      if (!ex) continue;
      counts[ex.primary] = (counts[ex.primary] ?? 0) + setsPerExercise;
      // Secondary muscles get about half the stimulus of the primary.
      for (const m of ex.secondary) counts[m] = (counts[m] ?? 0) + setsPerExercise / 2;
    }
  }
  for (const k of Object.keys(counts)) counts[k] = Math.round(counts[k]);
  return counts;
}

const average = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Gyms have 1.25 kg plates; anything finer is not loadable. */
const round = (kg) => Math.round(kg / 1.25) * 1.25;
