"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft, Check, Dumbbell, Flame, HeartPulse, Loader2, Plus, Search, Timer, Trophy,
} from "lucide-react";
import {
  ACTIVITIES, KIND_LABEL, byKind, caloriesBurned, grossCalories,
  type Activity, type ActivityKind,
} from "@/lib/fitness/activities";
import {
  EQUIPMENT_LABEL, MUSCLE_LABEL, SPLITS, byId, byMuscle, findExercises,
  type Exercise, type Muscle, type SplitName,
} from "@/lib/fitness/training";

/**
 * Choosing what you did.
 *
 * Two questions, not one. The first is what kind of training this was — the
 * gym and a game of badminton are logged completely differently, and asking
 * for sets and reps for a run is nonsense. The second depends on the answer:
 * lifting drills down to a split and then to exercises, while everything else
 * needs only a duration.
 *
 * Both paths end somewhere real. Lifting hands back an exercise to log sets
 * against; everything else hands back minutes and a calorie cost computed
 * from METs.
 */

type Stage =
  | { at: "kind" }
  | { at: "gym" }
  | { at: "muscle"; muscle: Muscle }
  | { at: "split"; split: SplitName }
  | { at: "activity"; kind: ActivityKind }
  | { at: "duration"; activity: Activity };

const KINDS: { kind: "gym" | ActivityKind; label: string; blurb: string; Icon: typeof Dumbbell }[] = [
  { kind: "gym", label: "Gym", blurb: "Weights, sets and reps", Icon: Dumbbell },
  { kind: "hiit", label: "HIIT", blurb: "Intervals and circuits", Icon: Flame },
  { kind: "cardio", label: "Cardio", blurb: "Run, ride, swim, row", Icon: HeartPulse },
  { kind: "sport", label: "Sport", blurb: "Cricket, football, badminton", Icon: Trophy },
  { kind: "class", label: "Class", blurb: "Yoga, pilates, martial arts", Icon: Timer },
  { kind: "daily", label: "Daily life", blurb: "Walking, housework, commuting", Icon: Timer },
];

export function TrainPicker({
  weightKg, onPickExercise, onLogActivity, onClose,
}: {
  weightKg: number;
  onPickExercise: (ex: Exercise) => void;
  onLogActivity: (a: Activity, minutes: number, kcal: number) => Promise<void>;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ at: "kind" });
  const [query, setQuery] = useState("");

  const results = useMemo(() => findExercises(query), [query]);

  const back = () => {
    if (stage.at === "kind") { onClose(); return; }
    if (stage.at === "muscle" || stage.at === "split") { setStage({ at: "gym" }); return; }
    if (stage.at === "duration") { setStage({ at: "activity", kind: stage.activity.kind }); return; }
    setStage({ at: "kind" });
  };

  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1.5 text-sm text-[var(--color-mute)]">
        <ArrowLeft size={15} /> {stage.at === "kind" ? "Close" : "Back"}
      </button>

      {/* --- what kind of session ------------------------------------ */}
      {stage.at === "kind" && (
        <>
          <h2 className="display text-2xl">What did you do?</h2>
          <ul className="grid grid-cols-2 gap-2.5">
            {KINDS.map(({ kind, label, blurb, Icon }) => (
              <li key={kind}>
                <button
                  onClick={() => setStage(kind === "gym"
                    ? { at: "gym" }
                    : { at: "activity", kind: kind as ActivityKind })}
                  className="card w-full p-3.5 text-left"
                >
                  <Icon size={19} className="text-[var(--color-chalk)]" />
                  <p className="mt-2 text-sm font-semibold">{label}</p>
                  <p className="text-[11px] leading-tight text-[var(--color-mute)]">{blurb}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* --- gym: by split, by muscle, or by name -------------------- */}
      {stage.at === "gym" && (
        <>
          <h2 className="display text-2xl">Gym</h2>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              className="field pl-9" placeholder="Search — bench press, squat, curl"
              aria-label="Search exercises"
            />
          </div>

          {query.trim() ? (
            <ExerciseList list={results} onPick={onPickExercise} />
          ) : (
            <>
              <section>
                <h3 className="label">By split</h3>
                <ul className="space-y-2">
                  {(Object.keys(SPLITS) as SplitName[]).map((k) => (
                    <li key={k}>
                      <button onClick={() => setStage({ at: "split", split: k })}
                              className="card w-full p-3.5 text-left">
                        <p className="text-sm font-semibold">{SPLITS[k].label}</p>
                        <p className="text-[11px] leading-relaxed text-[var(--color-mute)]">
                          {SPLITS[k].blurb}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="label">By muscle</h3>
                <ul className="flex flex-wrap gap-2">
                  {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
                    <li key={m}>
                      <button onClick={() => setStage({ at: "muscle", muscle: m })} className="chip">
                        {MUSCLE_LABEL[m]}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}

      {stage.at === "muscle" && (
        <>
          <h2 className="display text-2xl">{MUSCLE_LABEL[stage.muscle]}</h2>
          <ExerciseList list={byMuscle(stage.muscle)} onPick={onPickExercise} />
        </>
      )}

      {stage.at === "split" && (
        <>
          <h2 className="display text-2xl">{SPLITS[stage.split].label}</h2>
          {SPLITS[stage.split].sessions.map((session) => (
            <section key={session.name}>
              <h3 className="label">{session.name}</h3>
              <ExerciseList
                list={session.exerciseIds.map(byId).filter((e): e is Exercise => e !== null)}
                onPick={onPickExercise}
              />
            </section>
          ))}
        </>
      )}

      {/* --- everything that is logged by time ------------------------ */}
      {stage.at === "activity" && (
        <>
          <h2 className="display text-2xl">{KIND_LABEL[stage.kind]}</h2>
          <ul className="space-y-2">
            {byKind(stage.kind).map((a) => (
              <li key={a.id}>
                <button onClick={() => setStage({ at: "duration", activity: a })}
                        className="card flex w-full items-center gap-3 p-3.5 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.name}</span>
                    {a.detail && (
                      <span className="block text-[11px] text-[var(--color-mute)]">{a.detail}</span>
                    )}
                  </span>
                  <span className="num shrink-0 text-[11px] text-[var(--color-mute)]">
                    {a.met} MET
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {stage.at === "duration" && (
        <Duration
          activity={stage.activity}
          weightKg={weightKg}
          onLog={onLogActivity}
        />
      )}
    </div>
  );
}

function ExerciseList({ list, onPick }: { list: Exercise[]; onPick: (e: Exercise) => void }) {
  if (!list.length) {
    return (
      <p className="card p-5 text-center text-sm text-[var(--color-mute)]">
        Nothing matches. Try a muscle name, or add it as your own below.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {list.map((e) => (
        <li key={e.id}>
          <button onClick={() => onPick(e)} className="card flex w-full items-center gap-3 p-3.5 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{e.name}</span>
              <span className="block text-[11px] text-[var(--color-mute)]">
                {MUSCLE_LABEL[e.primary]} · {EQUIPMENT_LABEL[e.equipment]} · {e.repRange[0]}–{e.repRange[1]} reps
              </span>
            </span>
            <Plus size={16} className="shrink-0 text-[var(--color-mute)]" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * How long, and what it cost.
 *
 * The gross figure is shown alongside the net one, quietly, because almost
 * every other app reports the gross number and someone comparing the two will
 * otherwise think this one is broken. It is not — it is the one that can be
 * added to a day without counting your resting burn twice.
 */
function Duration({ activity, weightKg, onLog }: {
  activity: Activity;
  weightKg: number;
  onLog: (a: Activity, minutes: number, kcal: number) => Promise<void>;
}) {
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);

  const net = caloriesBurned(activity.met, weightKg, minutes);
  const gross = grossCalories(activity.met, weightKg, minutes);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-2xl">{activity.name}</h2>
        {activity.detail && <p className="text-sm text-[var(--color-mute)]">{activity.detail}</p>}
      </div>

      <div className="card p-4">
        <label className="label" htmlFor="mins">
          How long? <span className="num normal-case tracking-normal">{minutes} min</span>
        </label>
        <input
          id="mins" type="range" min={5} max={180} step={5} value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-full accent-[var(--color-chalk)]"
        />
        <div className="mt-1 flex flex-wrap gap-1.5">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} onClick={() => setMinutes(m)} className="chip">{m} min</button>
          ))}
        </div>

        <p className="display mt-5 text-5xl">
          {net}
          <span className="ml-2 text-sm font-semibold text-[var(--color-mute)]">kcal burned</span>
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-mute)]">
          Net of what you would have burned anyway. Most apps would call this{" "}
          <span className="num">{gross}</span> — that figure includes your resting burn,
          which your maintenance already counts, so adding it to a day counts it twice.
        </p>
      </div>

      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await onLog(activity, minutes, net); } finally { setBusy(false); }
        }}
        className="btn btn-primary w-full"
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
        Log {minutes} minutes
      </button>
    </div>
  );
}

export { ACTIVITIES };
