"use client";

import {
  type ActivityLevel, type Goal, type Sex, dailyTargets, type Profile,
} from "@/lib/fitness/energy";
import { project } from "@/lib/fitness/projection";
import { forGrams, sum, EMPTY, type Nutrients } from "@/lib/nutrition/types";
import {
  SPLITS, byId as exerciseById, nextPrescription, splitFor, weekPlan, weeklyVolume,
  type SplitName,
} from "@/lib/fitness/training";
import type {
  DayResponse, DiaryEntry, ProfileResponse, StoredProfile, Day, PlanResponse,
} from "@/lib/shape";

/**
 * The app, with no backend.
 *
 * Sign-in needs a Firebase project and the diary needs a Supabase one, and
 * until both exist the app can do nothing at all — which is a miserable first
 * five minutes for something you have just cloned. So when neither is
 * configured it runs against the browser's own storage instead: real
 * onboarding, real targets, real logging, real rings.
 *
 * What is *not* duplicated is the arithmetic. Targets and projections come
 * from the same `dailyTargets` and `project` the server uses, and food is
 * scaled by the same `forGrams`. Only the storage is different, so the two
 * modes cannot drift on anything that matters.
 *
 * What you lose: no sync between devices, no photo recognition, no coach.
 * Clearing site data clears the diary. It says so on screen.
 */

const KEY = "macro.demo.v1";

interface DemoState {
  profile: StoredProfile | null;
  days: Record<string, Partial<Day>>;
  diary: Record<string, DiaryEntry[]>;
}

const EMPTY_STATE: DemoState = { profile: null, days: {}, diary: {} };

function read(): DemoState {
  if (typeof localStorage === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : EMPTY_STATE;
  } catch {
    // Private mode, or storage disabled. The app still runs, it just forgets.
    return EMPTY_STATE;
  }
}

function write(s: DemoState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* nothing to do */ }
}

export function demoHasData(): boolean {
  const s = read();
  return Boolean(s.profile?.onboarded_at);
}

export function clearDemo(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}

/** The profile in the shape the science layer wants, or null if incomplete. */
function asProfile(p: StoredProfile | null, weightKg: number | null): Profile | null {
  if (!p?.sex || !p.height_cm || !p.birth_date || weightKg == null) return null;
  const b = new Date(`${p.birth_date}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;

  return {
    sex: p.sex as Sex,
    age: Math.max(13, Math.min(age, 100)),
    heightCm: Number(p.height_cm),
    weightKg,
    activity: p.activity as ActivityLevel,
    goal: p.goal as Goal,
    bodyFatPct: null,
    targetWeightKg: p.target_weight_kg != null ? Number(p.target_weight_kg) : null,
    trainingDaysPerWeek: p.training_days,
  };
}

function latestWeight(s: DemoState): number | null {
  const dated = Object.entries(s.days)
    .filter(([, d]) => d.weight_kg != null)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return dated.length ? Number(dated[0][1].weight_kg) : null;
}

function trend(s: DemoState): { date: string; weightKg: number; trendKg: number }[] {
  const rows = Object.entries(s.days)
    .filter(([, d]) => d.weight_kg != null)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, d]) => ({ date, weightKg: Number(d.weight_kg) }));

  return rows.map((r, i) => {
    const window = rows.slice(Math.max(0, i - 6), i + 1);
    const t = window.reduce((acc, x) => acc + x.weightKg, 0) / window.length;
    return { ...r, trendKg: Math.round(t * 10) / 10 };
  });
}

/* ------------------------------------------------------------------ */
/* The routes, served locally                                          */
/* ------------------------------------------------------------------ */

export function demoProfile(): ProfileResponse {
  const s = read();
  const weightKg = latestWeight(s);
  const profile = asProfile(s.profile, weightKg);

  if (!profile) {
    return { profile: s.profile, complete: false, weightKg, targets: null, projection: null };
  }

  const targets = dailyTargets(profile);
  return {
    profile: s.profile,
    complete: true,
    weightKg: profile.weightKg,
    targets: { ...targets, overridden: false },
    projection: project(profile, targets.kcal),
  };
}

export function demoSaveProfile(patch: Record<string, unknown>): ProfileResponse {
  const s = read();
  const base: StoredProfile = s.profile ?? {
    uid: "demo", display_name: null, email: null, sex: null, birth_date: null,
    height_cm: null, activity: "sedentary", goal: "maintain",
    target_weight_kg: null, training_days: 3, split: null,
    kcal_override: null, protein_override: null, carbs_override: null,
    fat_override: null, units: "metric", timezone: "Asia/Kolkata",
    onboarded_at: null,
  };

  const next = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "onboarded") { next.onboarded_at = new Date().toISOString(); continue; }
    next[k] = v;
  }

  s.profile = next as unknown as StoredProfile;
  write(s);
  return demoProfile();
}

export function demoDay(date: string): DayResponse {
  const s = read();
  const weightKg = latestWeight(s);
  const profile = asProfile(s.profile, weightKg);
  const entries = s.diary[date] ?? [];
  const totals: Nutrients = entries.length ? sum(entries.map((e) => e.nutrients)) : EMPTY;
  const targets = profile ? dailyTargets(profile) : null;
  const forecast = profile && targets ? project(profile, targets.kcal) : null;

  return {
    date,
    day: {
      uid: "demo", on_date: date, weight_kg: s.days[date]?.weight_kg ?? null,
      rest_day: s.days[date]?.rest_day ?? false,
      cheat_day: s.days[date]?.cheat_day ?? false,
      steps: null, sleep_hours: null, water_ml: s.days[date]?.water_ml ?? 0,
      mood: null, note: null,
    },
    entries,
    totals,
    targets,
    composition: profile && targets ? {
      sex: profile.sex, heightCm: profile.heightCm, weightKg: profile.weightKg,
      bodyFatPct: targets.bodyFatPct, leanKg: targets.leanKg,
    } : null,
    forecast: forecast && {
      weeksToGoal: forecast.weeksToGoal,
      daysToGoal: forecast.weeksToGoal != null ? forecast.weeksToGoal * 7 : null,
      goalDate: forecast.goalDate,
      targetWeightKg: forecast.targetWeightKg,
      verdict: forecast.verdict,
      atGoal: forecast.weeksToGoal != null
        ? forecast.weeks[forecast.weeksToGoal - 1] ?? null
        : forecast.weeks.at(-1) ?? null,
    },
    remaining: targets ? {
      kcal: Math.round(targets.kcal - totals.kcal),
      protein: Math.round(targets.protein - totals.protein),
      carbs: Math.round(targets.carbs - totals.carbs),
      fat: Math.round(targets.fat - totals.fat),
      fibre: Math.round(targets.fibre - totals.fibre),
    } : null,
    trend: trend(s),
  };
}

export function demoSaveDay(date: string, patch: Partial<Day>): void {
  const s = read();
  s.days[date] = { ...s.days[date], ...patch };
  write(s);
}

export function demoAddEntry(input: {
  date: string; name: string; brand?: string | null; grams: number;
  per100g: Nutrients; source: string; sourceId?: string | null;
  confidence?: string | null; meal?: string;
}): DiaryEntry {
  const s = read();
  const entry: DiaryEntry = {
    id: crypto.randomUUID(),
    uid: "demo",
    on_date: input.date,
    meal: (input.meal as DiaryEntry["meal"]) ?? guessMeal(),
    name: input.name,
    brand: input.brand ?? null,
    grams: input.grams,
    source: input.source,
    source_id: input.sourceId ?? null,
    confidence: input.confidence ?? null,
    // Scaled by the same function the server uses.
    nutrients: forGrams(input.per100g, input.grams),
    per_100g: input.per100g,
    photo_path: null,
    logged_at: new Date().toISOString(),
  };
  s.diary[input.date] = [...(s.diary[input.date] ?? []), entry];
  write(s);
  return entry;
}

export function demoDeleteEntry(id: string): boolean {
  const s = read();
  let found = false;
  for (const date of Object.keys(s.diary)) {
    const before = s.diary[date].length;
    s.diary[date] = s.diary[date].filter((e) => e.id !== id);
    if (s.diary[date].length !== before) found = true;
  }
  if (found) write(s);
  return found;
}

function guessMeal(): DiaryEntry["meal"] {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 22) return "dinner";
  return "snack";
}


/**
 * Today's session, worked out locally.
 *
 * The split and the week's layout are pure functions of how many days someone
 * trains, so they need no server at all. What standalone mode genuinely
 * cannot do is progression: that reads your last session for each lift, and
 * without saved workouts there is nothing to read. Every exercise therefore
 * comes back as a first time, which is honest — it is what the server would
 * say too, for someone who has never logged a set.
 */
export function demoPlan(date: string): PlanResponse {
  const s = read();
  const days = s.profile?.training_days ?? 3;
  const stored = s.profile?.split as SplitName | null | undefined;
  const split: SplitName = stored && stored in SPLITS ? stored : splitFor(days);

  const week = weekPlan(days, split);
  // Monday-first, matching weekPlan.
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const session = week[dow];
  const rest = s.days[date]?.rest_day === true;

  const shared = {
    date,
    split,
    splitLabel: SPLITS[split].label,
    blurb: SPLITS[split].blurb,
    week: week.map((x) => x?.name ?? null),
    weeklyVolume: weeklyVolume(SPLITS[split].sessions),
  };

  if (rest || !session) {
    return {
      ...shared,
      restDay: true,
      session: null,
      reason: rest
        ? "You marked today as a rest day."
        : "Rest day — this is where the training you already did turns into muscle.",
    };
  }

  return {
    ...shared,
    restDay: false,
    session: { name: session.name, focus: session.focus },
    exercises: session.exerciseIds
      .map(exerciseById)
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((ex) => ({ ...ex, last: null, prescription: nextPrescription(ex, null) })),
  };
}
