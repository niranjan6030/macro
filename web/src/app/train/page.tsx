"use client";

import { useCallback, useState } from "react";
import { Loader2, Check, Bed, Plus, TrendingUp, Info } from "lucide-react";
import { get, post, put, today } from "@/lib/client";
import { useResource } from "@/lib/useResource";
import { tapFeedback } from "@/lib/native";
import type { PlanResponse, PlanExercise } from "@/lib/shape";

/**
 * Today's session.
 *
 * The prescription is not a template — each exercise carries what was lifted
 * last time and what to do about it, worked out by the progression engine.
 * That is the difference between a workout log and a programme.
 */
export default function TrainPage() {
  const date = today();
  const [workoutId, setWorkoutId] = useState<string | null>(null);

  const fetcher = useCallback(
    () => get<PlanResponse>(`/api/plan?date=${date}`),
    [date],
  );
  const { data: plan, loading, error, reload, setError } = useResource(fetcher);

  // The session row is created lazily, on the first set logged — so opening
  // the tab and walking away does not leave an empty workout in the history.
  const ensureWorkout = useCallback(async () => {
    if (workoutId) return workoutId;
    const { workout } = await post<{ workout: { id: string } }>("/api/workouts", {
      date, name: plan?.session?.name ?? "Session", split: plan?.split,
    });
    setWorkoutId(workout.id);
    return workout.id;
  }, [workoutId, date, plan]);

  if (loading) {
    return <div className="grid h-[70vh] place-items-center"><Loader2 className="animate-spin text-[var(--color-mute)]" /></div>;
  }

  return (
    <div className="space-y-4 py-6">
      <header>
        <p className="label mb-1">{plan?.splitLabel}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {plan?.restDay ? "Rest day" : plan?.session?.name ?? "Training"}
        </h1>
      </header>

      {error && <p role="alert" className="card p-4 text-sm text-[var(--color-bad)]">{error}</p>}

      {plan?.restDay && (
        <div className="card space-y-4 p-6 text-center">
          <Bed size={32} className="mx-auto text-[var(--color-volt)]" />
          <p className="text-sm leading-relaxed text-[var(--color-mute)]">{plan.reason}</p>
          <button
            onClick={async () => { await put("/api/day", { date, rest_day: false }); reload(); }}
            className="btn btn-ghost w-full"
          >
            Train anyway
          </button>
        </div>
      )}

      {!plan?.restDay && plan?.exercises?.map((ex) => (
        <ExerciseCard key={ex.id} ex={ex} ensureWorkout={ensureWorkout} onError={setError} />
      ))}

      {!plan?.restDay && (
        <button
          onClick={async () => { await put("/api/day", { date, rest_day: true }); reload(); }}
          className="btn btn-ghost w-full"
        >
          <Bed size={17} /> Make today a rest day
        </button>
      )}

      {plan?.week && (
        <section className="card p-4">
          <h2 className="label">Your week</h2>
          <ul className="space-y-1.5 text-sm">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <li key={d} className="flex justify-between">
                <span className="text-[var(--color-mute)]">{d}</span>
                <span className={plan.week[i] ? "font-medium" : "text-[var(--color-mute)]"}>
                  {plan.week[i] ?? "Rest"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan?.weeklyVolume && Object.keys(plan.weeklyVolume).length > 0 && (
        <section className="card p-4">
          <h2 className="label">Weekly sets per muscle</h2>
          <ul className="space-y-1.5">
            {Object.entries(plan.weeklyVolume)
              .sort((a, b) => b[1] - a[1])
              .map(([muscle, sets]) => (
                <li key={muscle} className="flex items-center gap-3 text-sm">
                  <span className="w-20 shrink-0 capitalize text-[var(--color-mute)]">{muscle}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                    <span className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(sets / 22, 1) * 100}%`,
                            background: sets >= 10 ? "var(--color-volt)" : "var(--color-warn)",
                          }} />
                  </span>
                  <span className="num w-6 text-right text-xs">{sets}</span>
                </li>
              ))}
          </ul>
          <p className="mt-3 flex gap-1.5 text-xs leading-relaxed text-[var(--color-mute)]">
            <Info size={13} className="mt-px shrink-0" />
            Ten hard sets a week is roughly where a muscle starts growing; past twenty is
            usually more than you can recover from.
          </p>
        </section>
      )}
    </div>
  );
}

function ExerciseCard({ ex, ensureWorkout, onError }: {
  ex: PlanExercise;
  ensureWorkout: () => Promise<string>;
  onError: (m: string) => void;
}) {
  const p = ex.prescription;
  const [weight, setWeight] = useState(p.weightKg != null ? String(p.weightKg) : "");
  const [reps, setReps] = useState(String(p.reps));
  const [rir, setRir] = useState("2");
  const [logged, setLogged] = useState<{ weightKg: number; reps: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState<string | null>(null);

  const target = p.sets;

  return (
    <section className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{ex.name}</h2>
          <p className="text-xs capitalize text-[var(--color-mute)]">
            {ex.primary} · {ex.equipment} · {ex.repRange[0]}–{ex.repRange[1]} reps
          </p>
        </div>
        <span className="num shrink-0 text-sm text-[var(--color-mute)]">
          {logged.length}/{target}
        </span>
      </div>

      <p className="mt-2.5 flex gap-1.5 rounded-lg bg-[var(--color-slab-2)] p-2.5 text-xs leading-relaxed text-[var(--color-mute)]">
        <TrendingUp size={13} className="mt-px shrink-0 text-[var(--color-volt)]" />
        {next ?? p.reason}
      </p>

      {ex.last && (
        <p className="num mt-2 text-xs text-[var(--color-mute)]">
          Last time: {ex.last.map((s) => `${s.weightKg}×${s.reps}`).join("  ")}
        </p>
      )}

      {logged.length > 0 && (
        <ul className="num mt-2 flex flex-wrap gap-1.5">
          {logged.map((s, i) => (
            <li key={i} className="chip" style={{ color: "var(--color-volt)", borderColor: "var(--color-volt-dim)" }}>
              <Check size={11} /> {s.weightKg} × {s.reps}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const id = await ensureWorkout();
            const res = await post<{ next: { reason: string } }>(`/api/workouts/${id}/sets`, {
              exercise_id: ex.id,
              weight_kg: Number(weight) || 0,
              reps: Number(reps) || 0,
              rir: rir === "" ? null : Number(rir),
            });
            setLogged((l) => [...l, { weightKg: Number(weight) || 0, reps: Number(reps) || 0 }]);
            setNext(res.next?.reason ?? null);
            await tapFeedback("medium");
          } catch (e2) {
            onError(e2 instanceof Error ? e2.message : "Could not save that set.");
          } finally { setBusy(false); }
        }}
      >
        <label className="flex-1">
          <span className="label">kg</span>
          <input inputMode="decimal" className="field num" value={weight}
                 onChange={(e) => setWeight(e.target.value)} placeholder="—" />
        </label>
        <label className="flex-1">
          <span className="label">reps</span>
          <input inputMode="numeric" className="field num" value={reps}
                 onChange={(e) => setReps(e.target.value)} />
        </label>
        <label className="w-16">
          <span className="label" title="Reps in reserve">RIR</span>
          <input inputMode="numeric" className="field num" value={rir}
                 onChange={(e) => setRir(e.target.value)} />
        </label>
        <button type="submit" disabled={busy} className="btn btn-primary px-4"
                aria-label={`Log a set of ${ex.name}`}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={18} />}
        </button>
      </form>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-mute)]">{ex.cue}</p>
    </section>
  );
}
