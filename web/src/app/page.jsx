"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Bed,
  Cookie,
  Scale,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { MacroBars, TrendChart } from "@/components/Rings";
import { ScrollStory } from "@/components/ScrollStory";
import { useBody } from "@/lib/bodyStore";
import { get, put, del, today, prettyDate, shiftDate } from "@/lib/client";
import { useResource } from "@/lib/useResource";

/**
 * Today.
 *
 * Answers one question above the fold — how much have I got left — and then
 * gets out of the way. Everything below it is the detail behind that number.
 */
export default function TodayPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  const [date, setDate] = useState(today());

  const fetcher = useCallback(() => get(`/api/day?date=${date}`), [date]);
  const { data, loading, error, reload } = useResource(fetcher);

  // Not set up yet: there is nothing meaningful to show without targets.
  useEffect(() => {
    if (data && !data.targets && !loading) router.replace("/onboarding");
  }, [data, loading, router]);

  /* Hand the figure this person's body. The scene itself lives in the root
     layout — one WebGL context for the whole app. */
  const setComposition = useBody((s) => s.setComposition);
  useEffect(() => {
    if (data?.composition) setComposition(data.composition);
  }, [data, setComposition]);

  if (!ready || (loading && !data)) {
    return (
      <div className="grid h-[70vh] place-items-center">
        <Loader2 className="animate-spin text-[var(--color-mute)]" />
      </div>
    );
  }
  if (!user) {
    router.replace("/account");
    return null;
  }

  async function patchDay(patch) {
    await put("/api/day", { date, ...patch });
    reload();
  }

  const totals = data?.totals;
  const meals = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <div className="space-y-5 py-6">
      <header className="flex items-center justify-between">
        <button
          onClick={() => setDate(shiftDate(date, -1))}
          aria-label="Previous day"
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line)]"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="display text-2xl">{prettyDate(date)}</h1>
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          aria-label="Next day"
          disabled={date >= today()}
          className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line)] disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </header>

      {error && (
        <p role="alert" className="card p-4 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {totals && (
        <>
          {/* The day, told against the figure it is building. */}
          <ScrollStory data={data} />

          <section className="card p-4">
            <MacroBars totals={totals} targets={data.targets} />
          </section>
        </>
      )}

      {/* Rest and cheat days: recorded honestly, never hidden. */}
      <div className="grid grid-cols-2 gap-3">
        <Toggle
          on={data?.day.rest_day ?? false}
          onClick={() => patchDay({ rest_day: !data?.day.rest_day })}
          Icon={Bed}
          label="Rest day"
          hint={data?.day.rest_day ? "Training paused today" : "No session planned"}
        />
        <Toggle
          on={data?.day.cheat_day ?? false}
          onClick={() => patchDay({ cheat_day: !data?.day.cheat_day })}
          Icon={Cookie}
          label="Cheat day"
          hint={data?.day.cheat_day ? "Excluded from your streak" : "Still logged, just flagged"}
        />
      </div>

      <WeighIn value={data?.day.weight_kg ?? null} onSave={(kg) => patchDay({ weight_kg: kg })} />

      <div className="grid grid-cols-2 gap-3">
        <Link href="/train" className="btn btn-ghost justify-center">
          <Dumbbell size={18} /> Session
        </Link>
        <Link href="/progress" className="btn btn-ghost justify-center">
          <Sparkles size={18} /> Progress
        </Link>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="label mb-0">Food</h2>
          <Link
            href={`/food?date=${date}`}
            className="flex items-center gap-1 text-sm font-semibold text-[var(--color-volt)]"
          >
            <Plus size={16} /> Add
          </Link>
        </div>

        {!data?.entries.length ? (
          <p className="card p-6 text-center text-sm text-[var(--color-mute)]">
            Nothing logged yet. Snap a photo, scan a barcode, or search for it.
          </p>
        ) : (
          <div className="space-y-4">
            {meals.map((meal) => {
              const items = data.entries.filter((e) => e.meal === meal);
              if (!items.length) return null;
              const kcal = Math.round(items.reduce((t, e) => t + e.nutrients.kcal, 0));

              return (
                <div key={meal}>
                  <div className="mb-1.5 flex justify-between text-xs font-semibold uppercase tracking-wide text-[var(--color-mute)]">
                    <span>{meal}</span>
                    <span className="num">{kcal} kcal</span>
                  </div>
                  <ul className="card divide-y divide-[var(--color-line)]">
                    {items.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.name}</p>
                          <p className="num text-xs text-[var(--color-mute)]">
                            {Math.round(e.grams)} g{e.brand && ` · ${e.brand}`}
                            {e.confidence === "estimated" && " · estimate"}
                          </p>
                        </div>
                        <span className="num text-sm font-semibold">
                          {Math.round(e.nutrients.kcal)}
                        </span>
                        <button
                          aria-label={`Remove ${e.name}`}
                          onClick={async () => {
                            await del(`/api/diary?id=${e.id}`);
                            reload();
                          }}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--color-mute)]"
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {data?.trend && data.trend.length > 1 && (
        <section className="card p-4">
          <h2 className="label">Weight trend</h2>
          <TrendChart data={data.trend} />
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-mute)]">
            Dots are what the scale said. The line is the seven-day average — that is the one that
            reflects fat, rather than yesterday&apos;s salt.
          </p>
        </section>
      )}
    </div>
  );
}

function Toggle({ on, onClick, Icon, label, hint }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="card p-3.5 text-left"
      style={{
        borderColor: on ? "var(--color-volt)" : undefined,
        background: on ? "color-mix(in srgb, var(--color-volt) 8%, var(--color-slab))" : undefined,
      }}
    >
      <span style={{ color: on ? "var(--color-volt)" : "var(--color-mute)" }}>
        <Icon size={18} />
      </span>
      <p className="mt-1.5 text-sm font-semibold">{label}</p>
      <p className="text-[11px] leading-tight text-[var(--color-mute)]">{hint}</p>
    </button>
  );
}

function WeighIn({ value, onSave }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value ? String(value) : "");
          setEditing(true);
        }}
        className="card flex w-full items-center gap-3 p-4 text-left"
      >
        <Scale size={18} className="text-[var(--color-mute)]" />
        <span className="flex-1 text-sm font-medium">
          {value ? "Weight today" : "Log your weight"}
        </span>
        <span className="num text-sm font-semibold">{value ? `${value} kg` : "—"}</span>
      </button>
    );
  }

  return (
    <form
      className="card flex gap-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const kg = Number(draft);
        if (kg >= 25 && kg <= 400) {
          onSave(kg);
          setEditing(false);
        }
      }}
    >
      <input
        autoFocus
        inputMode="decimal"
        className="field num flex-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="78.5"
        aria-label="Weight in kilograms"
      />
      <button type="submit" className="btn btn-primary">
        Save
      </button>
    </form>
  );
}
