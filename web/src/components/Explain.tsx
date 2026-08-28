"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

/**
 * What the words mean.
 *
 * The app shows people BMR, TDEE, FFMI and body fat percentage and then makes
 * decisions from them. Most people have not met three of those four, and a
 * number you do not understand is a number you cannot argue with — which is
 * the wrong relationship to have with something telling you what to eat.
 *
 * So every term is explained where it appears, in a sentence, in plain words,
 * with the thing it is actually for. Collapsed by default so it costs nothing
 * to someone who already knows.
 */

export interface Term {
  term: string;
  short: string;
  body: string;
}

export const TERMS: Record<string, Term> = {
  bmr: {
    term: "BMR",
    short: "Basal metabolic rate",
    body:
      "What your body burns doing nothing at all — lying still, awake, not digesting. "
      + "Breathing, pumping blood, keeping your brain and organs running. It is roughly "
      + "60-70% of everything you burn in a day, and you cannot go below it for long "
      + "without your body fighting back.",
  },
  tdee: {
    term: "Maintenance",
    short: "Total daily energy expenditure",
    body:
      "Everything you burn in a real day: your BMR, plus moving around, plus training, "
      + "plus digesting food. Eat this and your weight holds. Eat under it and you lose. "
      + "It is the single number the whole plan is built on.",
  },
  ffmi: {
    term: "FFMI",
    short: "Fat-free mass index",
    body:
      "How much muscle you carry for your height. Like BMI, except it ignores fat "
      + "entirely — which means, unlike BMI, you cannot raise it by gaining weight. "
      + "Around 18-20 is untrained, 21-22 is well trained, and 23-25 is about the "
      + "ceiling without drugs.",
  },
  bodyFat: {
    term: "Body fat %",
    short: "What share of you is fat",
    body:
      "Two people at the same weight can look completely different, and this is why. "
      + "For men, 10-15% is lean with abs showing, 18-24% is average, above 25% is "
      + "where it starts affecting health. Women run about eight points higher at every "
      + "level — that is biology, not a different standard.",
  },
  bmi: {
    term: "BMI",
    short: "Body mass index",
    body:
      "Weight divided by height squared. It is useful across a population and often "
      + "wrong about an individual, because it has no idea whether your weight is "
      + "muscle or fat. It files a lean athlete and a sedentary person of the same "
      + "weight in the same box. Macro uses it, but never on its own.",
  },
  protein: {
    term: "Protein",
    short: "The one macro that is not optional",
    body:
      "It is what muscle is made of, and in a deficit it is what decides whether the "
      + "weight you lose comes off as fat or as muscle. This is why your target is set "
      + "from your lean mass rather than from a percentage of your calories.",
  },
  fibre: {
    term: "Fibre",
    short: "Carbohydrate you cannot digest",
    body:
      "It feeds your gut bacteria, slows sugar absorption, and is most of what makes "
      + "a meal feel finished. The target is 14 g per 1000 calories, which is the "
      + "Institute of Medicine's figure. Almost nobody hits it.",
  },
  deficit: {
    term: "Deficit",
    short: "Eating under maintenance",
    body:
      "The gap between what you burn and what you eat. About 500 a day loses roughly "
      + "half a kilo a week at first — and less as you get lighter, because a smaller "
      + "body burns less. Macro accounts for that, which is why its date moves.",
  },
};

/** One term, expandable. */
export function Explain({ id, className }: { id: keyof typeof TERMS; className?: string }) {
  const [open, setOpen] = useState(false);
  const t = TERMS[id];
  if (!t) return null;

  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] font-semibold text-[var(--color-mute)]"
      >
        <Info size={11} /> What is {t.term}?
        <ChevronDown
          size={11}
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms" }}
        />
      </button>
      {open && (
        <p className="mt-1.5 max-w-prose text-[12px] leading-relaxed text-[var(--color-mute)]">
          <strong className="text-[var(--color-chalk)]">{t.short}.</strong> {t.body}
        </p>
      )}
    </div>
  );
}

/** The whole glossary, for the account screen. */
export function Glossary() {
  return (
    <section className="card p-4">
      <h2 className="label">What the numbers mean</h2>
      <dl className="divide-y divide-[var(--color-line)]">
        {Object.values(TERMS).map((t) => (
          <div key={t.term} className="py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-semibold">
              {t.term}
              <span className="ml-2 font-normal text-[var(--color-mute)]">{t.short}</span>
            </dt>
            <dd className="mt-1 text-[13px] leading-relaxed text-[var(--color-mute)]">{t.body}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
