"use client";

import { Suspense, useState } from "react";
import { SignIn } from "@/components/SignIn";

/**
 * The signed-out landing screen.
 *
 * Laid out around the figure rather than above it: the headline crosses the
 * body, the way a title crosses the object it names. That overlap is the
 * whole composition — put the text in a column beside it and it becomes an
 * ordinary marketing page with a picture.
 *
 * The sign-in controls stay collapsed until asked for, so the first thing on
 * screen is the claim and not a wall of buttons.
 */
export function Landing() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-h-[100svh] pb-16">
      <header className="flex items-center justify-between pt-6">
        <p className="text-sm font-semibold tracking-tight">
          Macro<span className="text-[var(--color-mute)]">.</span>
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-mute)]">
          Food · Training · Progress
        </p>
      </header>

      {/* min-h keeps the headline crossing the figure's chest at any height. */}
      <section className="flex min-h-[62svh] flex-col justify-center">
        <h1 className="display text-[3.4rem] leading-[0.95] sm:text-7xl">
          Know exactly
          <br />
          <span className="text-[var(--color-mute)]">what you eat.</span>
        </h1>
      </section>

      {/* A scrim under the copy. The figure's legs run straight through this
          band, and grey text on a lit white thigh is unreadable — the gradient
          keeps the type legible without hiding the body behind a panel. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 -z-[5] h-[62svh]"
        style={{ background: "linear-gradient(to top, #000 22%, rgba(0,0,0,0.82) 48%, transparent 100%)" }}
      />

      <div className="relative max-w-sm space-y-6">
        <p className="text-[15px] leading-relaxed text-[var(--color-mute)]">
          Photograph a meal and Macro names every food in it, then takes the
          numbers from a nutrition database rather than guessing them. Train to
          a programme that reads what you lifted last week. Watch the trend,
          not the scale.
        </p>

        {!open ? (
          <div className="flex flex-wrap gap-2.5">
            <button onClick={() => setOpen(true)} className="btn btn-primary">
              Get started
            </button>
            <button onClick={() => setOpen(true)} className="btn btn-ghost">
              Sign in
            </button>
          </div>
        ) : (
          <Suspense fallback={null}>
            <SignIn />
          </Suspense>
        )}

        <p className="text-[11px] leading-relaxed text-[var(--color-mute)]">
          Your food, your training and your photos stay yours. Progress photos
          are stored privately and are never sent to the AI.
        </p>
      </div>
    </div>
  );
}
