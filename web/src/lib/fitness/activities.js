/**
 * Everything that is not lifting: cardio, sport, classes, walking.
 *
 * Energy cost comes from METs — multiples of resting metabolic rate — taken
 * from the Compendium of Physical Activities, which is the reference every
 * serious calculator uses and most consumer apps quietly approximate.
 *
 *   Ainsworth BE et al. (2011) Med Sci Sports Exerc 43:1575-81
 *
 * One thing here is done differently from almost every other tracker, and it
 * is worth understanding, because it is the difference between a number that
 * is roughly right and one that is roughly double.
 *
 * A MET value is *gross* energy expenditure: it includes the resting burn you
 * would have had anyway lying on the sofa. Your maintenance figure already
 * counts that resting burn for all twenty-four hours of the day. So adding
 * the gross cost of a run on top of maintenance counts the resting portion
 * twice, and for long low-intensity sessions — a two-hour walk, a round of
 * golf — the error is enormous.
 *
 * What is reported here is the *net* cost: (MET − 1), the energy the activity
 * adds over doing nothing. It is a smaller, less flattering number, and it is
 * the correct one to add to a day.
 */

export const ACTIVITIES = [
  // --- Cardio ------------------------------------------------------
  { id: "walk-easy", name: "Walking", kind: "cardio", met: 3.5, detail: "5 km/h, flat" },
  { id: "walk-brisk", name: "Brisk walking", kind: "cardio", met: 5.0, detail: "6.5 km/h" },
  { id: "walk-hill", name: "Hill walking", kind: "cardio", met: 6.5, detail: "uphill, steady" },
  { id: "run-easy", name: "Jogging", kind: "cardio", met: 8.3, detail: "8 km/h" },
  { id: "run-mod", name: "Running", kind: "cardio", met: 9.8, detail: "10 km/h" },
  { id: "run-fast", name: "Running, fast", kind: "cardio", met: 11.8, detail: "12 km/h" },
  { id: "cycle-easy", name: "Cycling, easy", kind: "cardio", met: 5.8, detail: "16-19 km/h" },
  { id: "cycle-mod", name: "Cycling", kind: "cardio", met: 8.0, detail: "19-22 km/h" },
  { id: "cycle-hard", name: "Cycling, hard", kind: "cardio", met: 10.0, detail: "22-26 km/h" },
  { id: "swim-mod", name: "Swimming", kind: "cardio", met: 5.8, detail: "steady laps" },
  { id: "swim-hard", name: "Swimming, hard", kind: "cardio", met: 9.8, detail: "fast laps" },
  { id: "row", name: "Rowing machine", kind: "cardio", met: 7.0, detail: "moderate" },
  { id: "elliptical", name: "Cross trainer", kind: "cardio", met: 5.0 },
  { id: "stairs", name: "Stair climber", kind: "cardio", met: 8.8 },
  { id: "skip", name: "Skipping rope", kind: "cardio", met: 11.0 },

  // --- HIIT and circuits -------------------------------------------
  { id: "hiit", name: "HIIT", kind: "hiit", met: 8.0, detail: "work/rest intervals" },
  { id: "circuit", name: "Circuit training", kind: "hiit", met: 7.5, detail: "minimal rest" },
  { id: "crossfit", name: "CrossFit / WOD", kind: "hiit", met: 8.5 },
  { id: "burpees", name: "Bodyweight conditioning", kind: "hiit", met: 8.0 },
  { id: "boxing-bag", name: "Boxing, bag work", kind: "hiit", met: 7.8 },

  // --- Sport --------------------------------------------------------
  { id: "cricket", name: "Cricket", kind: "sport", met: 4.8 },
  { id: "football", name: "Football", kind: "sport", met: 7.0, detail: "casual game" },
  { id: "badminton", name: "Badminton", kind: "sport", met: 5.5 },
  { id: "basketball", name: "Basketball", kind: "sport", met: 6.5 },
  { id: "tennis", name: "Tennis", kind: "sport", met: 7.3 },
  { id: "tabletennis", name: "Table tennis", kind: "sport", met: 4.0 },
  { id: "volleyball", name: "Volleyball", kind: "sport", met: 4.0 },
  { id: "kabaddi", name: "Kabaddi", kind: "sport", met: 7.0 },
  { id: "hockey", name: "Hockey", kind: "sport", met: 7.8 },

  // --- Classes and mobility ------------------------------------------
  { id: "yoga", name: "Yoga", kind: "class", met: 3.0, detail: "hatha" },
  { id: "power-yoga", name: "Power yoga", kind: "class", met: 4.5 },
  { id: "pilates", name: "Pilates", kind: "class", met: 3.8 },
  { id: "stretch", name: "Stretching / mobility", kind: "class", met: 2.3 },
  { id: "dance", name: "Dance", kind: "class", met: 5.0 },
  { id: "zumba", name: "Zumba / aerobics", kind: "class", met: 6.5 },
  { id: "martial", name: "Martial arts", kind: "class", met: 8.0 },

  // --- Daily life -----------------------------------------------------
  { id: "housework", name: "Housework", kind: "daily", met: 3.3 },
  { id: "gardening", name: "Gardening", kind: "daily", met: 3.8 },
  { id: "carry", name: "Carrying / moving things", kind: "daily", met: 5.0 },
  { id: "cycle-commute", name: "Cycling to work", kind: "daily", met: 6.8 },
];

/** Weight training's own MET, for when a lifting session is logged by time. */
export const LIFTING_MET = { light: 3.5, moderate: 5.0, hard: 6.0 };

export const KIND_LABEL = {
  cardio: "Cardio",
  hiit: "HIIT and circuits",
  sport: "Sport",
  class: "Classes and mobility",
  daily: "Daily life",
};

export const byId = (id) => ACTIVITIES.find((a) => a.id === id) ?? null;

export const byKind = (kind) => ACTIVITIES.filter((a) => a.kind === kind);

/**
 * Net calories burned by an activity.
 *
 * `(MET − 1)` rather than `MET`, for the reason set out at the top of this
 * file: the resting portion is already in your maintenance figure, and
 * counting it again is how a one-hour walk turns into a licence for a second
 * dinner.
 *
 * The constant is the standard conversion: one MET is 3.5 ml of oxygen per kg
 * per minute, and a litre of oxygen releases about 5 kcal.
 */
export function caloriesBurned(met, weightKg, minutes) {
  const net = Math.max(met - 1, 0);
  return Math.round(net * weightKg * 0.0175 * minutes);
}

/** What the same session would have been reported as, counting gross. */
export function grossCalories(met, weightKg, minutes) {
  return Math.round(met * weightKg * 0.0175 * minutes);
}
