"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, ChevronDown, Dumbbell, Flame, HeartPulse, Loader2, Plus,
  Search, Timer, Trash2, Trophy,
} from "lucide-react";
import {
  byKind, caloriesBurned, grossCalories,
  type Activity, type ActivityKind,
} from "@/lib/fitness/activities";
import {
  EQUIPMENT_LABEL, MUSCLE_LABEL, SPLITS, byId, byMuscle, findExercises,
  type Equipment, type Exercise, type Muscle, type SplitName,
} from "@/lib/fitness/training";

/**
 * Choosing what you did.
 *
 * A session is rarely one thing. Lifting for forty minutes and then walking
 * home is two entries, and asking "which one was it?" makes the second one
 * not get logged. So the kinds are chips you turn on, several at once, and
 * everything you turned on opens up underneath — splits and muscles for the
 * gym, a list of activities for anything timed.
 *
 * The library is sixty-five lifts, which is most of a commercial gym and
 * none of what anyone does at home with a resistance band. Whatever is
 * missing you add yourself, and it behaves like the rest: same rep ranges,
 * same progression, same weekly set counts.
 */

type Stage =
  | { at: "browse" }
  | { at: "muscle"; muscle: Muscle }
  | { at: "duration"; activity: Activity }
  | { at: "new" };

type Kind = "gym" | ActivityKind;

const KINDS: { kind: Kind; label: string; blurb: string; Icon: typeof Dumbbell }[] = [
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
  const [stage, setStage] = useState<Stage>({ at: "browse" });
  const [picked, setPicked] = useState<Set<Kind>>(new Set<Kind>(["gym"]));
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState<Exercise[]>([]);

  useEffect(() => {
    let live = true;
    fetch("/api/exercises")
      .then((r) => (r.ok ? r.json() : { exercises: [] }))
      .then((d) => { if (live) setMine(d.exercises ?? []); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  // Searching should reach across everything, including the movements you
  // added — otherwise your own exercises are the only ones you cannot find
  // by typing their name.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...mine.filter((e) => e.name.toLowerCase().includes(q)), ...findExercises(query)];
  }, [query, mine]);

  const toggle = (k: Kind) =>
    setPicked((prev) => {
      const next = new Set(prev);
      // The last chip stays on. An empty screen is not a state anyone wants.
      if (next.has(k)) { if (next.size > 1) next.delete(k); } else next.add(k);
      return next;
    });

  const back = () => (stage.at === "browse" ? onClose() : setStage({ at: "browse" }));

  return (
    <div className="space-y-4">
      <button onClick={back} className="flex items-center gap-1.5 text-sm text-[var(--color-mute)]">
        <ArrowLeft size={15} /> {stage.at === "browse" ? "Close" : "Back"}
      </button>

      {stage.at === "browse" && (
        <>
          <div>
            <h2 className="display text-2xl">What did you do?</h2>
            <p className="text-[11px] text-[var(--color-mute)]">
              Pick as many as you like — everything you choose opens up below.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-2.5">
            {KINDS.map(({ kind, label, blurb, Icon }) => {
              const on = picked.has(kind);
              return (
                <li key={kind}>
                  <button
                    onClick={() => toggle(kind)}
                    aria-pressed={on}
                    className={`card relative w-full p-3.5 text-left transition-colors ${
                      on ? "border-[var(--color-chalk)] bg-white/[0.06]" : ""
                    }`}
                  >
                    {on && (
                      <Check size={14} className="absolute right-3 top-3 text-[var(--color-chalk)]" />
                    )}
                    <Icon size={19} className={on ? "text-[var(--color-chalk)]" : "text-[var(--color-mute)]"} />
                    <p className="mt-2 text-sm font-semibold">{label}</p>
                    <p className="text-[11px] leading-tight text-[var(--color-mute)]">{blurb}</p>
                  </button>
                </li>
              );
            })}
          </ul>

          {picked.has("gym") && (
            <section className="space-y-3 border-t border-[var(--color-line)] pt-4">
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
                  <div>
                    <h3 className="label">By split</h3>
                    <ul className="space-y-2">
                      {(Object.keys(SPLITS) as SplitName[]).map((k) => (
                        <Split key={k} name={k} onPick={onPickExercise} />
                      ))}
                    </ul>
                  </div>

                  <div>
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
                  </div>
                </>
              )}
            </section>
          )}

          {KINDS.filter((k) => k.kind !== "gym" && picked.has(k.kind)).map(({ kind, label }) => (
            <section key={kind} className="border-t border-[var(--color-line)] pt-4">
              <h3 className="label">{label}</h3>
              <ul className="space-y-2">
                {byKind(kind as ActivityKind).map((a) => (
                  <li key={a.id}>
                    <button onClick={() => setStage({ at: "duration", activity: a })}
                            className="card flex w-full items-center gap-3 p-3.5 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{a.name}</span>
                        {a.detail && (
                          <span className="block text-[11px] text-[var(--color-mute)]">{a.detail}</span>
                        )}
                      </span>
                      <span className="num shrink-0 text-[11px] text-[var(--color-mute)]">{a.met} MET</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* --- whatever the library missed --------------------------- */}
          <section className="border-t border-[var(--color-line)] pt-4">
            <h3 className="label">Your own</h3>
            {mine.length > 0 && (
              <ul className="mb-2 space-y-2">
                {mine.map((e) => (
                  <li key={e.id} className="flex items-center gap-2">
                    <button onClick={() => onPickExercise(e)}
                            className="card min-w-0 flex-1 p-3.5 text-left">
                      <span className="block text-sm font-medium">{e.name}</span>
                      <span className="block text-[11px] text-[var(--color-mute)]">
                        {MUSCLE_LABEL[e.primary]} · {EQUIPMENT_LABEL[e.equipment]} ·{" "}
                        {e.repRange[0]}–{e.repRange[1]} reps
                      </span>
                    </button>
                    <button
                      aria-label={`Remove ${e.name}`}
                      onClick={async () => {
                        const id = e.id.replace(/^custom:/, "");
                        await fetch(`/api/exercises?id=${id}`, { method: "DELETE" });
                        setMine((prev) => prev.filter((x) => x.id !== e.id));
                      }}
                      className="shrink-0 p-2.5 text-[var(--color-mute)]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setStage({ at: "new" })} className="btn w-full">
              <Plus size={16} /> Add your own movement
            </button>
          </section>
        </>
      )}

      {stage.at === "muscle" && (
        <>
          <h2 className="display text-2xl">{MUSCLE_LABEL[stage.muscle]}</h2>
          <ExerciseList
            list={[...mine.filter((e) => e.primary === stage.muscle), ...byMuscle(stage.muscle)]}
            onPick={onPickExercise}
          />
        </>
      )}

      {stage.at === "duration" && (
        <Duration activity={stage.activity} weightKg={weightKg} onLog={onLogActivity} />
      )}

      {stage.at === "new" && (
        <NewExercise
          onAdded={(e) => {
            setMine((prev) => [...prev, e].sort((a, b) => a.name.localeCompare(b.name)));
            setStage({ at: "browse" });
          }}
        />
      )}
    </div>
  );
}

/** A split that opens where it stands, so Push, Pull and Legs are one tap away. */
function Split({ name, onPick }: { name: SplitName; onPick: (e: Exercise) => void }) {
  const [open, setOpen] = useState(false);
  const def = SPLITS[name];

  return (
    <li>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="card flex w-full items-center gap-3 p-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{def.label}</span>
          <span className="block text-[11px] leading-relaxed text-[var(--color-mute)]">{def.blurb}</span>
        </span>
        <ChevronDown size={16}
          className={`shrink-0 text-[var(--color-mute)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-3 border-l border-[var(--color-line)] pl-3">
          {def.sessions.map((session) => (
            <section key={session.name}>
              <h4 className="label">{session.name}</h4>
              <ExerciseList
                list={session.exerciseIds.map(byId).filter((e): e is Exercise => e !== null)}
                onPick={onPick}
              />
            </section>
          ))}
        </div>
      )}
    </li>
  );
}

function NewExercise({ onAdded }: { onAdded: (e: Exercise) => void }) {
  const [name, setName] = useState("");
  const [primary, setPrimary] = useState<Muscle>("chest");
  const [equipment, setEquipment] = useState<Equipment>("bodyweight");
  const [repLow, setRepLow] = useState(8);
  const [repHigh, setRepHigh] = useState(12);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, primary, equipment, repLow, repHigh, note }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not save that."); return; }
      onAdded(data.exercise);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="display text-2xl">Your own movement</h2>
        <p className="text-[11px] leading-relaxed text-[var(--color-mute)]">
          It joins the library for you alone, and progresses the same way — the
          weight goes up once you hit the top of the rep range on every set.
        </p>
      </div>

      <div className="card space-y-3 p-4">
        <div>
          <label className="label" htmlFor="ex-name">Name</label>
          <input id="ex-name" value={name} onChange={(e) => setName(e.target.value)}
                 className="field" placeholder="Band pull-apart" maxLength={60} />
        </div>

        <div>
          <label className="label" htmlFor="ex-muscle">Muscle worked</label>
          <select id="ex-muscle" value={primary}
                  onChange={(e) => setPrimary(e.target.value as Muscle)} className="field">
            {(Object.keys(MUSCLE_LABEL) as Muscle[]).map((m) => (
              <option key={m} value={m}>{MUSCLE_LABEL[m]}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ex-kit">Equipment</label>
          <select id="ex-kit" value={equipment}
                  onChange={(e) => setEquipment(e.target.value as Equipment)} className="field">
            {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((k) => (
              <option key={k} value={k}>{EQUIPMENT_LABEL[k]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ex-low">Reps from</label>
            <input id="ex-low" type="number" inputMode="numeric" min={1} max={100} value={repLow}
                   onChange={(e) => setRepLow(Number(e.target.value))} className="field num" />
          </div>
          <div>
            <label className="label" htmlFor="ex-high">Reps to</label>
            <input id="ex-high" type="number" inputMode="numeric" min={1} max={200} value={repHigh}
                   onChange={(e) => setRepHigh(Number(e.target.value))} className="field num" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ex-note">Cue <span className="normal-case">(optional)</span></label>
          <input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)}
                 className="field" placeholder="Arms straight, squeeze the shoulder blades" maxLength={200} />
        </div>
      </div>

      {error && <p className="text-sm text-[var(--color-warn,#e8845c)]">{error}</p>}

      <button disabled={busy || !name.trim()} onClick={save} className="btn btn-primary w-full">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Add it
      </button>
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
