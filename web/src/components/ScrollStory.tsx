"use client";

import { useEffect, useRef, useState } from "react";
import type { DayResponse } from "@/lib/shape";

/**
 * The day, told as you scroll.
 *
 * The figure turns behind these panels, so scrolling does two things at once:
 * it walks through today's numbers and it walks around the body those numbers
 * are building. That pairing is the argument the whole screen is making — the
 * calories are not an abstract budget, they are the thing changing the shape
 * behind them.
 *
 * Panels are spaced a screen apart and fade in on entry. IntersectionObserver
 * rather than scroll maths: it does the work off the main thread, and a
 * scroll handler recomputing eleven bounding boxes per frame is what makes
 * pages like this stutter on a phone.
 */

export function ScrollStory({ data }: { data: DayResponse }) {
  const t = data.targets;
  const totals = data.totals;
  const rem = data.remaining;
  const f = data.forecast;

  if (!t || !rem) return null;

  const over = rem.kcal < 0;

  return (
    <div className="space-y-[46svh] pb-[30svh]">
      <Panel>
        <Eyebrow>Today</Eyebrow>
        <Big value={Math.abs(rem.kcal)} tone={over ? "warn" : "bright"} />
        <Caption>{over ? "calories over" : "calories left"}</Caption>
        <Meter value={totals.kcal} target={t.kcal} />
        <Note>
          {Math.round(totals.kcal)} eaten of {t.kcal}. Maintenance is {t.tdee}.
        </Note>
      </Panel>

      <Panel>
        <Eyebrow>Protein</Eyebrow>
        <Big value={Math.round(totals.protein)} suffix="g" />
        <Caption>of {t.protein} g</Caption>
        <Meter value={totals.protein} target={t.protein} />
        <Note>
          {rem.protein > 0
            ? `${rem.protein} g to go. This is the one that decides whether the weight you lose is fat or muscle.`
            : "Hit. That is the one that protects muscle while you cut."}
        </Note>
      </Panel>

      <Panel>
        <Eyebrow>Carbs and fat</Eyebrow>
        <div className="flex gap-10">
          <span>
            <Big value={Math.round(totals.carbs)} suffix="g" size="mid" />
            <Caption>carbs of {t.carbs}</Caption>
          </span>
          <span>
            <Big value={Math.round(totals.fat)} suffix="g" size="mid" />
            <Caption>fat of {t.fat}</Caption>
          </span>
        </div>
        <Meter value={totals.carbs} target={t.carbs} />
        <Meter value={totals.fat} target={t.fat} />
        <Note>
          Fibre {Math.round(totals.fibre)} of {t.fibre} g.
        </Note>
      </Panel>

      {f && (
        <Panel>
          <Eyebrow>{f.daysToGoal != null ? "Days to go" : "Where this goes"}</Eyebrow>
          {f.daysToGoal != null ? (
            <>
              <Big value={f.daysToGoal} />
              <Caption>
                days to {f.targetWeightKg} kg{f.goalDate ? ` · ${prettyMonth(f.goalDate)}` : ""}
              </Caption>
            </>
          ) : (
            <p className="display text-4xl leading-tight">Not at this intake.</p>
          )}
          <Note>{f.verdict}</Note>
          {f.atGoal && (
            <Note>
              At that point you would be around {f.atGoal.weightKg} kg at{" "}
              {f.atGoal.bodyFatPct}% body fat, holding {f.atGoal.leanKg} kg of lean
              mass. The figure behind this is your body now, not then.
            </Note>
          )}
        </Panel>
      )}

      <Panel>
        <Eyebrow>Your body</Eyebrow>
        <Big value={data.composition ? round1(data.composition.weightKg) : 0} suffix="kg" />
        <Caption>
          {data.composition ? `${round1(data.composition.bodyFatPct)}% body fat` : "not set up yet"}
        </Caption>
        <Note>
          The figure is built from these two numbers. It changes when they do —
          slowly, the way you will. Weigh in most days and it keeps up.
        </Note>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShown(e.isIntersecting),
      // Fires when the panel reaches the middle band of the screen, so the
      // text arrives as the figure behind it is well in view.
      { rootMargin: "-25% 0px -35% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="min-h-[54svh] max-w-xs space-y-2"
      style={{
        opacity: shown ? 1 : 0.12,
        transform: shown ? "translateY(0)" : "translateY(14px)",
        transition: "opacity 600ms ease, transform 600ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      {children}
    </section>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-mute)]">
    {children}
  </p>
);

function Big({ value, suffix, tone = "bright", size = "big" }: {
  value: number; suffix?: string; tone?: "bright" | "warn"; size?: "big" | "mid";
}) {
  return (
    <p
      className={`display leading-none ${size === "big" ? "text-[4.6rem]" : "text-5xl"}`}
      style={{ color: tone === "warn" ? "var(--color-warn)" : "var(--color-chalk)" }}
    >
      {value}
      {suffix && <span className="ml-1 font-sans text-lg not-italic">{suffix}</span>}
    </p>
  );
}

const Caption = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs tracking-wide text-[var(--color-mute)]">{children}</p>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="pt-1 text-[13px] leading-relaxed text-[var(--color-mute)]">{children}</p>
);

/** A hairline of progress. Overfills past the target rather than capping. */
function Meter({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target * 1.02;
  return (
    <span className="mt-2 block h-px w-full bg-[var(--color-line)]">
      <span
        className="block h-px"
        style={{
          width: `${pct * 100}%`,
          background: over ? "var(--color-warn)" : "var(--color-chalk)",
          transition: "width 600ms ease-out",
        }}
      />
    </span>
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const prettyMonth = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
