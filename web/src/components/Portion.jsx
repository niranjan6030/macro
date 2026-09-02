"use client";

import { useMemo, useState } from "react";
import { portionsFor, COUNTS, countLabel } from "@/lib/nutrition/portions";

/**
 * How much of it, asked in a way a person can answer.
 *
 * Two taps: which measure, and how many. The grams appear underneath as a
 * consequence rather than a question, and stay editable for the one case
 * where someone genuinely knows — a packet with the weight printed on it.
 *
 * The default is one of whatever suits the food, which for most dishes is
 * the right answer already, so the common case is no taps at all.
 */
export function Portion({ food, grams, onGrams, label }) {
  const { portions, note } = useMemo(() => portionsFor(food), [food]);
  const [chosen, setChosen] = useState(portions[0]);
  const [count, setCount] = useState(1);
  const [byHand, setByHand] = useState(false);

  const apply = (portion, n) => {
    setChosen(portion);
    setCount(n);
    onGrams(Math.round(portion.grams * n));
  };

  return (
    <div className="space-y-2.5">
      <div>
        <span className="label">How much?</span>
        <ul className="flex flex-wrap gap-1.5">
          {portions.map((p) => {
            const on = !byHand && chosen?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => { setByHand(false); apply(p, count); }}
                  aria-pressed={on}
                  className="chip"
                  style={on ? { color: "var(--color-volt)", borderColor: "var(--color-volt)" } : undefined}
                >
                  {p.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {!byHand && (
        <div>
          <span className="label">How many?</span>
          <ul className="flex flex-wrap gap-1.5">
            {COUNTS.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => apply(chosen, n)}
                  aria-pressed={count === n}
                  className="chip"
                  style={count === n
                    ? { color: "var(--color-volt)", borderColor: "var(--color-volt)" }
                    : undefined}
                >
                  {countLabel(n)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={grams}
          onChange={(e) => { setByHand(true); onGrams(Math.max(0, Number(e.target.value) || 0)); }}
          className="field num w-24"
          aria-label={label ?? "Grams"}
        />
        <span className="text-sm text-[var(--color-mute)]">grams</span>
        {!byHand && chosen && (
          <span className="ml-auto text-[11px] text-[var(--color-mute)]">
            {countLabel(count)} × {chosen.label.toLowerCase()}
          </span>
        )}
      </div>

      {note && !byHand && (
        <p className="text-[11px] leading-relaxed text-[var(--color-mute)]">{note}</p>
      )}
    </div>
  );
}
