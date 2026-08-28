"use client";

import type { Nutrients, Targets } from "@/lib/shape";

/**
 * The calorie ring and the macro bars.
 *
 * The ring is deliberately allowed to overfill past 100% and turn amber
 * rather than capping at full: a tracker that cannot show you went over is
 * not tracking, it is flattering. Being over is information, not a failure,
 * and the app states it without any red-alert theatre.
 */

export function CalorieRing({ eaten, target, size = 190 }: {
  eaten: number; target: number; size?: number;
}) {
  const pct = target > 0 ? eaten / target : 0;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const over = pct > 1;
  // Past 100% the ring restarts, so the overshoot is visible as its own arc.
  const shown = Math.min(over ? pct - 1 : pct, 1);
  const colour = over ? "var(--color-warn)" : "var(--color-volt)";
  const remaining = Math.round(target - eaten);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={over ? "var(--color-volt)" : "var(--color-line)"} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={colour} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown)}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="num text-[2.6rem] font-bold leading-none"
           style={{ color: over ? "var(--color-warn)" : "var(--color-chalk)" }}>
          {Math.abs(remaining)}
        </p>
        <p className="mt-1 text-xs font-medium text-[var(--color-mute)]">
          {remaining >= 0 ? "kcal left" : "kcal over"}
        </p>
        <p className="num mt-2 text-[11px] text-[var(--color-mute)]">
          {Math.round(eaten)} / {target}
        </p>
      </div>
      <p className="sr-only">
        {Math.round(eaten)} of {target} calories eaten.
        {remaining >= 0 ? ` ${remaining} remaining.` : ` ${-remaining} over target.`}
      </p>
    </div>
  );
}

const MACROS = [
  { key: "protein", label: "Protein", colour: "var(--color-protein)" },
  { key: "carbs", label: "Carbs", colour: "var(--color-carbs)" },
  { key: "fat", label: "Fat", colour: "var(--color-fat)" },
  { key: "fibre", label: "Fibre", colour: "var(--color-fibre)" },
] as const;

export function MacroBars({ totals, targets }: { totals: Nutrients; targets: Targets | null }) {
  return (
    <div className="space-y-3">
      {MACROS.map(({ key, label, colour }) => {
        const eaten = totals[key];
        const target = targets?.[key] ?? 0;
        const pct = target > 0 ? Math.min(eaten / target, 1) : 0;
        const over = target > 0 && eaten > target * 1.1;

        return (
          <div key={key}>
            <div className="mb-1.5 flex items-baseline justify-between text-xs">
              <span className="font-medium">{label}</span>
              <span className="num text-[var(--color-mute)]">
                <span style={{ color: over ? "var(--color-warn)" : "var(--color-chalk)" }}>
                  {Math.round(eaten)}
                </span>
                {target > 0 && ` / ${target} g`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]">
              <div className="h-full rounded-full"
                   style={{ width: `${pct * 100}%`, background: colour, transition: "width 400ms ease-out" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bodyweight, raw against the seven-day average.
 *
 * The faint dots are the daily readings and the solid line is the trend.
 * Showing both is the point: it makes visible that the 800 g jump between
 * two dots did not change the line at all.
 */
export function TrendChart({ data, height = 120 }: {
  data: { date: string; weightKg: number; trendKg: number }[];
  height?: number;
}) {
  if (data.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-[var(--color-mute)]">
        Weigh in for a few days and the trend appears here.
      </p>
    );
  }

  const w = 320;
  const pad = 8;
  const values = data.flatMap((d) => [d.weightKg, d.trendKg]);
  const min = Math.min(...values) - 0.4;
  const max = Math.max(...values) + 0.4;
  const span = Math.max(max - min, 0.8);

  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.trendKg).toFixed(1)}`).join(" ");

  const first = data[0].trendKg;
  const last = data.at(-1)!.trendKg;
  const change = Math.round((last - first) * 10) / 10;

  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" role="img"
           aria-label={`Weight trend: ${first} kg to ${last} kg over ${data.length} weigh-ins.`}>
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.weightKg)} r={1.8} fill="var(--color-mute)" opacity={0.45} />
        ))}
        <path d={line} fill="none" stroke="var(--color-volt)" strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-xs text-[var(--color-mute)]">
        <span className="num">{first.toFixed(1)} kg</span>
        <span className="num" style={{ color: change === 0 ? undefined : "var(--color-volt)" }}>
          {change > 0 ? "+" : ""}{change} kg
        </span>
        <span className="num">{last.toFixed(1)} kg</span>
      </figcaption>
    </figure>
  );
}
