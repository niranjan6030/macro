"use client";

import { useEffect, useRef, useState } from "react";
import { ActivityRings, RingKey, type Ring } from "@/components/ActivityRings";
import { Explain } from "@/components/Explain";
import { physiqueOf } from "@/lib/fitness/physique";
import { BUILDS } from "@/lib/fitness/physique";
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

  const physique = data.composition ? physiqueOf(data.composition) : null;
  const build = physique ? BUILDS[physique.build] : null;
  const bmi = data.composition
    ? round1(data.composition.weightKg / (data.composition.heightCm / 100) ** 2)
    : null;

  /* Three rings, the way a day divides: what you ate, whether you got the
     protein, and whether you trained. Told apart by radius and brightness
     rather than hue, since the app is monochrome. */
  const rings: Ring[] = [
    { label: "Calories", value: totals.kcal, target: t.kcal, unit: "kcal", tone: "#ffffff" },
    { label: "Protein", value: totals.protein, target: t.protein, unit: "g", tone: "#b4b4b4" },
    { label: "Fibre", value: totals.fibre, target: t.fibre, unit: "g", tone: "#6e6e6e" },
  ];

  return (
    <div className="space-y-[46svh] pb-[30svh]">
      <Panel wide>
        <ActivityRings rings={rings}>
          <span className="text-center">
            <span
              className="display block text-[2.9rem] leading-none"
              style={{ color: over ? "var(--color-warn)" : "var(--color-chalk)" }}
            >
              {Math.abs(rem.kcal)}
            </span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-[var(--color-mute)]">
              {over ? "over" : "left"}
            </span>
          </span>
        </ActivityRings>
        <div className="mx-auto max-w-xs rounded-2xl bg-black/55 p-4 backdrop-blur-sm">
          <RingKey rings={rings} />
          <div className="mt-3 border-t border-[var(--color-line)] pt-3">
            <p className="text-[12px] leading-relaxed text-[var(--color-mute)]">
              {Math.round(totals.kcal)} eaten of {t.kcal}. Maintenance is {t.tdee}.
            </p>
            <Explain id="tdee" className="mt-2" />
          </div>
        </div>
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
        <Explain id="protein" />
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
        <Eyebrow>Your build</Eyebrow>
        {build ? (
          <>
            <p className="display text-[2.6rem] leading-tight"
               style={{ textShadow: "0 2px 24px rgba(0,0,0,0.95)" }}>
              {build.label}
            </p>
            <Note>{build.meaning}</Note>
            <p className="num pt-1 text-xs text-[var(--color-mute)]">
              {round1(data.composition!.weightKg)} kg · {round1(data.composition!.bodyFatPct)}% fat
              · BMI {bmi} · FFMI {physique!.ffmi}
            </p>
            <Note><strong className="text-[var(--color-chalk)]">Next:</strong> {build.next}</Note>
            <div className="pt-1"><Explain id="ffmi" /></div>
            <Note>
              The figure behind this is built from those numbers, and it moves as they
              do — so when this says something different in two months, so will the body.
            </Note>
          </>
        ) : (
          <Note>Log your height, weight and date of birth and your build appears here.</Note>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Panel({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
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
      className={`min-h-[54svh] ${wide ? "space-y-6" : "max-w-xs space-y-2"}`}
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
      style={{
        color: tone === "warn" ? "var(--color-warn)" : "var(--color-chalk)",
        // The figure is lit clay; type over it needs its own contrast.
        textShadow: "0 2px 24px rgba(0,0,0,0.95)",
      }}
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
  <p className="pt-1 text-[13px] leading-relaxed text-[var(--color-mute)]"
     style={{ textShadow: "0 1px 12px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)" }}>
    {children}
  </p>
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
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
