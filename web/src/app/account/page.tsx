"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings2, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Landing } from "@/components/Landing";
import { get } from "@/lib/client";
import type { ProfileResponse } from "@/lib/shape";

export default function AccountPage() {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<ProfileResponse | null>(null);

  useEffect(() => {
    if (!user) return;
    get<ProfileResponse>("/api/profile").then(setData).catch(() => setData(null));
  }, [user]);

  if (!ready) {
    return <div className="grid h-[70vh] place-items-center"><Loader2 className="animate-spin text-[var(--color-mute)]" /></div>;
  }

  if (!user) return <Landing />;

  const p = data?.profile;

  return (
    <div className="space-y-4 py-8">
      <header>
        <h1 className="display text-3xl">
          {p?.display_name ?? user.displayName ?? "Your account"}
        </h1>
        <p className="text-sm text-[var(--color-mute)]">
          {user.email ?? user.phoneNumber ?? "Signed in"}
        </p>
      </header>

      {data?.targets && (
        <section className="card p-4">
          <h2 className="label">Your daily targets</h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            {([
              ["kcal", data.targets.kcal, ""],
              ["protein", data.targets.protein, "g"],
              ["carbs", data.targets.carbs, "g"],
              ["fat", data.targets.fat, "g"],
            ] as const).map(([k, v, unit]) => (
              <div key={k}>
                <p className="num text-xl font-bold">{v}<span className="text-xs font-normal text-[var(--color-mute)]">{unit}</span></p>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">{k}</p>
              </div>
            ))}
          </div>
          {data.targets.overridden && (
            <p className="mt-3 text-xs text-[var(--color-warn)]">
              You have set these by hand, so Macro is not recalculating them.
            </p>
          )}
        </section>
      )}

      <Link href="/onboarding" className="btn btn-ghost w-full">
        <Settings2 size={18} /> {p?.onboarded_at ? "Edit your details" : "Finish setting up"}
      </Link>

      <Link href="/coach" className="btn btn-ghost w-full">Weekly review</Link>

      <button
        onClick={async () => { await signOut(); router.replace("/account"); router.refresh(); }}
        className="btn btn-ghost w-full text-[var(--color-bad)]"
      >
        <LogOut size={18} /> Sign out
      </button>
    </div>
  );
}
