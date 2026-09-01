"use client";

import { useCallback, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Sparkles,
  CalendarCheck,
  ArrowLeft,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { get, today } from "@/lib/client";
import { useResource } from "@/lib/useResource";
import { TrendChart } from "@/components/Rings";
import { Chat } from "@/components/Chat";

/**
 * The weekly review.
 *
 * Two projections sit side by side here: what the plan predicts, and what
 * their actual average intake predicts. The gap between the two is the
 * honest answer to "when will I get there", and showing both is what stops
 * the app from quietly congratulating someone who is not on track.
 */
export default function CoachPage() {
  const router = useRouter();
  /* `refresh` forces the model to write a new review rather than serving
     today's cached one. It is part of the fetch key so pressing the button
     actually re-requests. */
  const [tab, setTab] = useState("chat");
  const [refresh, setRefresh] = useState(false);

  const fetcher = useCallback(
    () => get(`/api/coach?date=${today()}${refresh ? "&refresh=1" : ""}`),
    [refresh],
  );
  const { data, loading, error, reload } = useResource(fetcher);

  const f = data?.findings;

  return (
    <div className="space-y-4 py-6">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-slab-2)]"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="display text-3xl">Macro AI</h1>
        <button
          onClick={() => {
            setRefresh(true);
            reload();
          }}
          aria-label="Rebuild review"
          className="ml-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--color-slab-2)]"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      {tab === "review" && error && (
        <div className="card p-4">
          <p role="alert" className="text-sm text-[var(--color-bad)]">
            {error}
          </p>
        </div>
      )}

      {tab === "review" && loading && !data && (
        <p className="flex items-center gap-2 py-10 text-sm text-[var(--color-mute)]">
          <Loader2 className="animate-spin" size={14} /> building your review
        </p>
      )}

      {/* Two ways to get the same information: the review reads itself out,
          the chat answers what you actually wanted to know. */}
      <div className="flex gap-1 rounded-xl bg-[var(--color-slab-2)] p-1">
        {[
          ["chat", "Ask", MessageSquare],
          ["review", "Weekly review", Sparkles],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
            style={{
              background: tab === k ? "var(--color-chalk)" : "transparent",
              color: tab === k ? "#000" : "var(--color-mute)",
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "chat" && <Chat />}

      {tab === "review" && data && (
        <>
          <section className="card p-5">
            <h2 className="label flex items-center gap-1.5">
              <Sparkles size={13} /> Last {data.window} days
            </h2>
            <p className="text-[15px] leading-relaxed">{data.body}</p>
            {data.ai === false && (
              <p className="mt-3 text-xs text-[var(--color-mute)]">
                Written from your figures. Set an AI key for a fuller review.
              </p>
            )}
          </section>

          {f && (
            <section className="card p-4">
              <h2 className="label">The numbers behind it</h2>
              <dl className="grid grid-cols-2 gap-y-3.5 gap-x-3">
                <Fact label="Days logged" value={`${f.daysLogged} of ${f.daysInWindow}`} />
                <Fact label="Sessions" value={`${f.sessionsDone} of ${f.sessionsPlanned}`} />
                <Fact
                  label="Average intake"
                  value={f.avgKcal != null ? `${f.avgKcal} kcal` : "—"}
                  sub={f.avgKcal != null ? `target ${f.targetKcal}` : undefined}
                />
                <Fact
                  label="Average protein"
                  value={f.avgProtein != null ? `${f.avgProtein} g` : "—"}
                  sub={f.avgProtein != null ? `target ${f.targetProtein} g` : undefined}
                />
                <Fact
                  label="Trend change"
                  value={
                    f.trendChangeKg != null
                      ? `${f.trendChangeKg > 0 ? "+" : ""}${f.trendChangeKg} kg`
                      : "—"
                  }
                />
                <Fact
                  label="Measured burn"
                  value={f.impliedTdee != null ? `${f.impliedTdee} kcal` : "—"}
                  sub={f.impliedTdee != null ? "from your own data" : "needs 7 weigh-ins"}
                />
              </dl>
              {f.notes.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-[var(--color-line)] pt-3">
                  {f.notes.map((n, i) => (
                    <li key={i} className="text-xs leading-relaxed text-[var(--color-mute)]">
                      · {n}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* The two projections, side by side. */}
          <section className="card p-4">
            <h2 className="label flex items-center gap-1.5">
              <CalendarCheck size={13} /> When you get there
            </h2>
            <div className="space-y-3">
              <Projection title="On plan" text={data.planned.verdict} accent />
              {data.actual ? (
                <Projection title="On what you have actually eaten" text={data.actual.verdict} />
              ) : (
                <p className="text-sm text-[var(--color-mute)]">
                  Log four days and Macro can project from what you really eat, not just the plan.
                </p>
              )}
            </div>
          </section>

          {data.weights.length > 1 && (
            <section className="card p-4">
              <h2 className="label">Weight</h2>
              <TrendChart data={data.weights} />
            </section>
          )}

          {data.workouts.length > 0 && (
            <section className="card p-4">
              <h2 className="label">Sessions</h2>
              <ul className="divide-y divide-[var(--color-line)]">
                {data.workouts.map((w, i) => (
                  <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium">{w.name}</span>
                    <span className="num text-xs text-[var(--color-mute)]">
                      {w.sets} sets · {w.volumeKg.toLocaleString()} kg
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Fact({ label, value, sub }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{label}</dt>
      <dd className="num font-semibold">{value}</dd>
      {sub && <dd className="num text-[10px] text-[var(--color-mute)]">{sub}</dd>}
    </div>
  );
}

function Projection({ title, text, accent }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: accent ? "var(--color-volt-dim)" : "var(--color-line)",
        background: accent
          ? "color-mix(in srgb, var(--color-volt) 6%, transparent)"
          : "var(--color-slab-2)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: accent ? "var(--color-volt)" : "var(--color-mute)" }}
      >
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
