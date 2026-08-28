"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Loader2, Check } from "lucide-react";
import { get, put, today } from "@/lib/client";
import { Explain } from "@/components/Explain";
import { ACTIVITY_LABEL, type ActivityLevel, type Goal, type Sex } from "@/lib/fitness/energy";
import type { ProfileResponse } from "@/lib/shape";

/**
 * Setup, in five short steps.
 *
 * Split into steps rather than presented as one long form because a single
 * screen of fifteen fields is where people abandon a fitness app. Each step
 * asks one thing, and every step after the first shows what has already been
 * worked out — so the form visibly earns the answers it is asking for.
 *
 * Weight is stored as today's entry in the diary rather than on the profile,
 * because it is a measurement and it will change next week.
 */

const STEPS = ["You", "Body", "Activity", "Goal", "Done"] as const;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [birth, setBirth] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState<ActivityLevel>("light");
  const [trainingDays, setTrainingDays] = useState(3);
  const [goal, setGoal] = useState<Goal>("lose");
  const [targetWeight, setTargetWeight] = useState("");

  const [result, setResult] = useState<ProfileResponse | null>(null);

  // Prefill when they come back to edit.
  useEffect(() => {
    get<ProfileResponse>("/api/profile").then((d) => {
      const p = d.profile;
      if (!p) return;
      setName(p.display_name ?? "");
      setSex((p.sex as Sex) ?? "");
      setBirth(p.birth_date ?? "");
      setHeight(p.height_cm ? String(p.height_cm) : "");
      setActivity(p.activity);
      setTrainingDays(p.training_days ?? 3);
      setGoal(p.goal);
      setTargetWeight(p.target_weight_kg ? String(p.target_weight_kg) : "");
      if (d.weightKg) setWeight(String(d.weightKg));
    }).catch(() => {});
  }, []);

  async function finish() {
    setBusy(true); setError("");
    try {
      await put("/api/profile", {
        display_name: name || null,
        sex, birth_date: birth,
        height_cm: Number(height),
        activity, training_days: trainingDays,
        goal,
        target_weight_kg: targetWeight ? Number(targetWeight) : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        onboarded: true,
      });
      // Weight is a measurement, so it goes into today's day record.
      await put("/api/day", { date: today(), weight_kg: Number(weight) });

      setResult(await get<ProfileResponse>("/api/profile"));
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  const canAdvance =
    step === 0 ? Boolean(sex && birth)
    : step === 1 ? Number(height) >= 80 && Number(weight) >= 25
    : true;

  return (
    <div className="py-8">
      <ol className="mb-8 flex gap-1.5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="h-1 flex-1 rounded-full"
              style={{ background: i <= step ? "var(--color-volt)" : "var(--color-line)" }}>
            <span className="sr-only">{s}</span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 px-4 py-3 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {step === 0 && (
        <Step title="Let's start with you" hint="Age and sex change the equations more than anything else here.">
          <Field label="Name (optional)">
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Date of birth">
            <input type="date" className="field num" value={birth} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <Field label="Sex">
            <Choice value={sex} onChange={setSex} options={[["male", "Male"], ["female", "Female"]]} />
            <p className="mt-2 text-xs text-[var(--color-mute)]">
              Used for the metabolic equations, which are sex-specific. Nothing else.
            </p>
          </Field>
        </Step>
      )}

      {step === 1 && (
        <Step title="Your measurements" hint="Weigh yourself first thing, after the loo, before eating — it is the most repeatable moment of the day.">
          <Field label="Height (cm)">
            <input inputMode="decimal" className="field num" value={height}
                   onChange={(e) => setHeight(e.target.value)} placeholder="175" />
          </Field>
          <Field label="Weight today (kg)">
            <input inputMode="decimal" className="field num" value={weight}
                   onChange={(e) => setWeight(e.target.value)} placeholder="78.5" />
          </Field>
        </Step>
      )}

      {step === 2 && (
        <Step title="How much do you move?" hint="Count your job and your daily life here. Training is counted separately, on the next line — that is how Macro avoids the double-counting that inflates most calculators.">
          <Field label="Daily life">
            <div className="space-y-2">
              {(Object.keys(ACTIVITY_LABEL) as ActivityLevel[]).map((k) => (
                <button key={k} onClick={() => setActivity(k)}
                        className="w-full rounded-xl border px-4 py-3 text-left text-sm"
                        style={{
                          borderColor: activity === k ? "var(--color-volt)" : "var(--color-line)",
                          background: activity === k ? "color-mix(in srgb, var(--color-volt) 10%, transparent)" : "var(--color-slab-2)",
                        }}>
                  {ACTIVITY_LABEL[k]}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Training sessions per week: ${trainingDays}`}>
            <input type="range" min={0} max={7} value={trainingDays} className="w-full accent-[var(--color-volt)]"
                   onChange={(e) => setTrainingDays(Number(e.target.value))} />
            <p className="mt-2 text-xs text-[var(--color-mute)]">
              {trainingDays <= 3 ? "Macro will build full-body sessions — the best use of three days or fewer."
                : trainingDays <= 5 ? "Upper/lower, so every muscle gets trained twice a week."
                : "Push/pull/legs, with the most room for volume."}
            </p>
          </Field>
        </Step>
      )}

      {step === 3 && (
        <Step title="What are you after?" hint="Macro caps the rate at what is actually achievable, so the date it gives you is one you can hit.">
          <Field label="Goal">
            <Choice value={goal} onChange={setGoal}
                    options={[["lose", "Lose fat"], ["maintain", "Maintain"], ["gain", "Build muscle"]]} />
          </Field>
          {goal !== "maintain" && (
            <Field label="Target weight (kg), optional">
              <input inputMode="decimal" className="field num" value={targetWeight}
                     onChange={(e) => setTargetWeight(e.target.value)}
                     placeholder={goal === "lose" ? "72" : "82"} />
              <p className="mt-2 text-xs text-[var(--color-mute)]">
                Leave it blank if you would rather just head in the right direction.
              </p>
            </Field>
          )}
        </Step>
      )}

      {step === 4 && result?.targets && (
        <div className="space-y-5">
          <div>
            <h1 className="display text-3xl">You are set up.</h1>
            <p className="mt-1 text-sm text-[var(--color-mute)]">
              These are calculated from your numbers, not from a lookup table. They will
              move as your weight does.
            </p>
          </div>

          <div className="card p-4">
            <p className="display text-6xl text-[var(--color-volt)]">
              {result.targets.kcal}
              <span className="ml-2 font-sans text-sm not-italic text-[var(--color-mute)]">kcal/day</span>
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Protein" value={`${result.targets.protein} g`} />
              <Stat label="Carbs" value={`${result.targets.carbs} g`} />
              <Stat label="Fat" value={`${result.targets.fat} g`} />
              <Stat label="Fibre" value={`${result.targets.fibre} g`} />
              <Stat label="Maintenance" value={`${result.targets.tdee} kcal`} />
              <Stat label="BMR" value={`${result.targets.bmr} kcal`} />
            </dl>

            <div className="mt-4 space-y-2 border-t border-[var(--color-line)] pt-3">
              <Explain id="bmr" />
              <Explain id="tdee" />
              <Explain id="protein" />
            </div>
          </div>

          {result.projection && (
            <p className="card p-4 text-sm leading-relaxed">{result.projection.verdict}</p>
          )}

          <button onClick={() => { router.replace("/"); router.refresh(); }} className="btn btn-primary w-full">
            <Check size={18} /> Start logging
          </button>
        </div>
      )}

      {step < 4 && (
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="btn btn-ghost">
              <ArrowLeft size={18} /> Back
            </button>
          )}
          <button
            onClick={() => (step === 3 ? finish() : setStep(step + 1))}
            disabled={!canAdvance || busy}
            className="btn btn-primary flex-1"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            {step === 3 ? "Work out my targets" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="display text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-mute)]">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="label">{label}</span>{children}</div>;
}

function Choice<T extends string>({ value, onChange, options }: {
  value: T | ""; onChange: (v: T) => void; options: [T, string][];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
                className="rounded-xl border px-3 py-3 text-sm font-medium"
                style={{
                  borderColor: value === v ? "var(--color-volt)" : "var(--color-line)",
                  background: value === v ? "color-mix(in srgb, var(--color-volt) 10%, transparent)" : "var(--color-slab-2)",
                }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{label}</dt>
      <dd className="num font-semibold">{value}</dd>
    </div>
  );
}
