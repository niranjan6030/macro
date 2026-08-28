"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Dumbbell, Camera, Sparkles, User } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/**
 * Five destinations, fixed to the bottom.
 *
 * Bottom rather than top because the whole app is used one-handed, and the
 * top of a large phone is out of thumb reach. Five is the ceiling before the
 * targets get too narrow to hit reliably.
 */
const TABS = [
  { href: "/", label: "Today", Icon: Flame },
  { href: "/food", label: "Food", Icon: Camera },
  { href: "/train", label: "Train", Icon: Dumbbell },
  { href: "/progress", label: "Progress", Icon: Sparkles },
  { href: "/account", label: "You", Icon: User },
];

export function TabBar() {
  const path = usePathname();
  const { user, ready } = useAuth();

  // Nothing to navigate to until they are in.
  if (ready && !user && path === "/account") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-line)]
                 bg-[color-mix(in_srgb,var(--color-ink)_92%,transparent)] backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex h-[68px] flex-col items-center justify-center gap-1"
                style={{ color: active ? "var(--color-volt)" : "var(--color-mute)" }}
              >
                <Icon size={21} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                <span className="text-[10px] font-semibold tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
