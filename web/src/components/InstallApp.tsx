"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

/**
 * "Install app".
 *
 * A web app you can add to the home screen is the right shape for this: one
 * codebase, one deploy, no store review, and it updates the moment you push.
 * The cost is that installing it works differently on every platform, and
 * neither of the two that matter makes it obvious.
 *
 * Chrome and Edge fire `beforeinstallprompt`, which can be captured and
 * replayed from a button of our own — that is the good path, and it is a real
 * one-tap install. Safari on iOS fires nothing and has no API at all: the only
 * way in is Share, then Add to Home Screen, so on iOS this explains that
 * rather than offering a button that cannot work.
 *
 * Once installed the app runs standalone with no browser chrome, which is
 * what `display-mode: standalone` detects — and this hides itself for good.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED = "macro.install.dismissed";

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // Already installed: nothing to offer.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED) === "1"; } catch { /* private mode */ }
    if (installed || dismissed) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
      && !/crios|fxios/i.test(navigator.userAgent);

    if (isIos) {
      /* Deferred by a frame rather than set here. Setting state synchronously
         inside an effect cascades a second render before the first has
         painted, and this card is the least urgent thing on the screen. */
      const t = setTimeout(() => { setIos(true); setHidden(false); }, 0);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      // Chrome shows its own mini-bar unless this is called.
      e.preventDefault();
      setPrompt(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setHidden(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* private mode */ }
  }

  return (
    <div className="card flex items-start gap-3 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Put Macro on your home screen</p>
        {ios ? (
          <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-relaxed text-[var(--color-mute)]">
            Tap <Share size={12} className="inline" /> Share, then
            <strong className="text-[var(--color-chalk)]">Add to Home Screen</strong>.
            It opens full screen, with no browser bar.
          </p>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">
            Runs full screen, opens offline, and updates itself. No app store.
          </p>
        )}

        {!ios && prompt && (
          <button
            className="btn btn-primary mt-3 w-full"
            onClick={async () => {
              await prompt.prompt();
              const { outcome } = await prompt.userChoice;
              if (outcome === "accepted") setHidden(true);
              setPrompt(null);
            }}
          >
            <Download size={16} /> Install
          </button>
        )}
      </div>

      <button onClick={dismiss} aria-label="Dismiss"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--color-mute)]">
        <X size={15} />
      </button>
    </div>
  );
}

/**
 * Register the service worker.
 *
 * Chrome will not offer to install a site that has no fetch handler, however
 * complete its manifest — so this is not optional for the install path, quite
 * apart from what it does for offline.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;   // it caches; not in dev
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Blocked, or an insecure origin. The app works without it.
      });
    }, 1500);   // after first paint; nothing here is urgent
    return () => clearTimeout(t);
  }, []);
  return null;
}
