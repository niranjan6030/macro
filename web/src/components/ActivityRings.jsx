"use client";

import { useEffect, useState } from "react";

/**
 * Three rings that close.
 *
 * The idea is Apple's, and it works for the same reason theirs does: a ring
 * is a target you can see the end of. A bar chart tells you a number; a ring
 * tells you how much is left, and it has an obvious finished state that a bar
 * never quite gets.
 *
 * Three, because three is what a day actually has in it here — what you ate,
 * whether you got the protein, and whether you trained. Apple's Move, Exercise
 * and Stand map almost exactly.
 *
 * Two details that make them read as rings rather than as arcs. The track is a
 * dimmed copy of the ring's own colour, not a neutral grey, so an empty ring
 * still says which one it is. And going past the target wraps a second lap
 * over the first rather than capping — being over is information, and a ring
 * that silently stops at full is lying to you.
 *
 * Monochrome, so they are told apart by radius and by weight rather than by
 * hue: the outermost is the brightest and the most important.
 */

export function ActivityRings({ rings, size = 196, stroke = 15, gap = 5, children }) {
  /* Animate from empty on mount, so the rings fill in front of you. Without
     it they are simply drawn already closed and the whole point is lost. */
  const [live, setLive] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLive(true), 90);
    return () => clearTimeout(t);
  }, []);

  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* The figure stands directly behind these, and white-on-lit-clay is
          unreadable. A soft disc sits the rings on their own ground without
          hiding the body — it fades out well before the edge. */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,0,0,0.92) 42%, rgba(0,0,0,0.72) 66%, transparent 82%)",
        }}
      />
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          {/* The lit tip. Subtle, but it is what stops a closed ring looking
              like a flat painted circle. */}
          <filter id="ring-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          if (r <= stroke) return null;

          const c = 2 * Math.PI * r;
          const raw = ring.target > 0 ? ring.value / ring.target : 0;
          const pct = live || reduced ? raw : 0;

          const closed = raw >= 1;
          // Past 100% a second lap draws over the first.
          const lap1 = Math.min(pct, 1);
          const lap2 = Math.max(0, Math.min(pct - 1, 1));

          return (
            <g key={ring.label}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={ring.tone}
                strokeOpacity={0.16}
                strokeWidth={stroke}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={ring.tone}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - lap1)}
                filter={closed ? "url(#ring-glow)" : undefined}
                style={{
                  transition: reduced
                    ? undefined
                    : `stroke-dashoffset 1100ms cubic-bezier(.15,.75,.25,1) ${i * 110}ms`,
                }}
              />
              {lap2 > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke="#000"
                  strokeOpacity={0.55}
                  strokeWidth={stroke * 0.42}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - lap2)}
                  style={{
                    transition: reduced
                      ? undefined
                      : `stroke-dashoffset 1100ms cubic-bezier(.15,.75,.25,1) ${i * 110 + 300}ms`,
                  }}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 grid place-items-center">{children}</div>

      <p className="sr-only">
        {rings.map((r) => `${r.label}: ${Math.round(r.value)} of ${r.target} ${r.unit}.`).join(" ")}
      </p>
    </div>
  );
}

/** The legend. Kept next to the rings, because a ring alone names nothing. */
export function RingKey({ rings }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {rings.map((r) => {
        const pct = r.target > 0 ? r.value / r.target : 0;
        const done = pct >= 1;
        return (
          <li key={r.label} className="flex items-baseline gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.tone, opacity: done ? 1 : 0.4 }}
            />
            <span className="text-sm">{r.label}</span>
            <span className="num ml-auto text-sm">
              <span style={{ color: done ? r.tone : "var(--color-chalk)" }}>
                {Math.round(r.value)}
              </span>
              <span className="text-[var(--color-mute)]">
                /{r.target} {r.unit}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
