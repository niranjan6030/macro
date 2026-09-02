"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

/**
 * Send someone without a profile back to setup.
 *
 * The middleware cannot do this. It runs at the edge, where there is no
 * database, and all it can check is whether a session cookie exists at all.
 * So the profile gate lives here, and it has to cover every page rather than
 * just the home screen — the version that only guarded "/" let anyone tap
 * Food during onboarding and land in an app with no age, no height and no
 * targets, which then quietly renders zeroes as though they were answers.
 */
const NEEDS_PROFILE = ["/", "/food", "/train", "/progress", "/coach"];

export function RequireProfile({ children }) {
  const { user, ready, configured } = useAuth();
  const path = usePathname();
  const router = useRouter();

  const gated = NEEDS_PROFILE.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

  useEffect(() => {
    if (!configured || !ready || !user || !gated) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok || !live) return;
        // `complete` is the route's own answer to "can this profile produce
        // targets?" — which is the actual question. Picking a field to test
        // here instead would be a second, quietly diverging definition of
        // finished.
        const { complete } = await res.json();
        if (live && !complete) router.replace("/onboarding");
      } catch {
        // Offline. The page shows its own "no connection" state; bouncing
        // someone to setup because their train went into a tunnel would be
        // worse than letting them look at yesterday's numbers.
      }
    })();
    return () => { live = false; };
  }, [configured, ready, user, gated, path, router]);

  return <>{children}</>;
}
