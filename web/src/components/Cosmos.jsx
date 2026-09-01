"use client";

/**
 * The two flat layers that sit over the 3D scene.
 *
 * The starfield and the glow used to live here as SVG and CSS. They are now
 * real geometry in `Scene`, drifting in the same space as the figure and
 * turning with it — which is the difference between a background image and a
 * background. What is left is the grain and the frame, both of which are
 * screen-space effects and have no business being in the 3D scene.
 */

/**
 * Film grain.
 *
 * Half of its job is texture. The other half is dithering: a large, smooth
 * dark gradient bands badly on a phone screen, and a little noise over the
 * top hides the steps completely.
 */
export function Grain() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, transparent 30%, rgba(0,0,0,0.55) 78%, #000 110%)",
        }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-[0.05] mix-blend-overlay">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={4}
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}

/**
 * The bracket frame.
 *
 * Four corner rules rather than a full border: it reads as a viewfinder,
 * which suits an app whose subject is looking at yourself, and it does not
 * box in a scrolling page the way a closed rectangle would.
 */
export function Frame() {
  const corner = "absolute h-5 w-5 border-[var(--color-line)]";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-3 z-30"
      style={{
        top: "calc(env(safe-area-inset-top) + 0.6rem)",
        bottom: "calc(72px + env(safe-area-inset-bottom))",
      }}
    >
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </div>
  );
}
