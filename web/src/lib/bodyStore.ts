"use client";

import { create } from "zustand";
import type { Composition } from "@/lib/fitness/physique";

/**
 * Whose body the figure is showing.
 *
 * There is exactly one 3D scene, mounted once in the root layout, because a
 * WebGL context is expensive and a second one behind the first would render a
 * whole invisible figure every frame. Pages that know the signed-in person's
 * composition push it in here; the scene picks it up and rebuilds.
 *
 * A store rather than context so that setting it from inside an effect does
 * not re-render the page tree that set it.
 */
interface BodyState {
  composition: Composition | null;
  setComposition: (c: Composition | null) => void;
}

export const useBody = create<BodyState>((set) => ({
  composition: null,
  setComposition: (composition) => set((prev) =>
    // Ignore no-op writes; the day payload arrives on every navigation and an
    // identical composition must not rebuild 14,000 vertices.
    same(prev.composition, composition) ? prev : { composition },
  ),
}));

function same(a: Composition | null, b: Composition | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.sex === b.sex
    && near(a.heightCm, b.heightCm)
    && near(a.weightKg, b.weightKg)
    && near(a.bodyFatPct, b.bodyFatPct)
    && near(a.leanKg, b.leanKg);
}
const near = (x: number, y: number) => Math.abs(x - y) < 0.05;
