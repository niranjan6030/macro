/**
 * The shapes the API answers with.
 *
 * Shared between the route handlers and the client so that a field renamed
 * on the server breaks the build rather than rendering "undefined" to
 * someone standing in a gym.
 */

import type { Nutrients, Food } from "@/lib/nutrition/types";
import type { Targets } from "@/lib/fitness/energy";
import type { Projection } from "@/lib/fitness/projection";
import type { StoredProfile, Day, DiaryEntry, PhotoRow, Measurement } from "@/lib/db";
import type { Exercise, Prescription } from "@/lib/fitness/training";

export type {
  Nutrients, Food, Targets, Projection, StoredProfile, Day, DiaryEntry,
  PhotoRow, Measurement,
};

export interface ProfileResponse {
  profile: StoredProfile | null;
  complete: boolean;
  weightKg: number | null;
  targets: (Targets & { overridden: boolean }) | null;
  projection: Projection | null;
}

/** One week of the projection, in the shape the figure wants. */
export interface ProjectedWeek {
  week: number;
  weightKg: number;
  bodyFatPct: number;
  leanKg: number;
  tdee: number;
}

export interface DayResponse {
  date: string;
  day: Day;
  entries: DiaryEntry[];
  totals: Nutrients;
  targets: Targets | null;
  remaining: {
    kcal: number; protein: number; carbs: number; fat: number; fibre: number;
  } | null;
  trend: { date: string; weightKg: number; trendKg: number }[];
}

export interface PlanExercise extends Exercise {
  last: { weightKg: number; reps: number; rir: number | null }[] | null;
  prescription: Prescription;
}

export interface PlanResponse {
  date: string;
  split: string;
  splitLabel: string;
  blurb?: string;
  restDay: boolean;
  reason?: string;
  session: { name: string; focus: string[] } | null;
  exercises?: PlanExercise[];
  week: (string | null)[];
  weeklyVolume: Record<string, number>;
}

export interface IdentifiedItemShape {
  label: string;
  grams: number;
  confidence: "high" | "medium" | "low";
  food: Food | null;
  nutrients: Nutrients | null;
  note?: string;
}

export interface IdentifyResponse {
  items: IdentifiedItemShape[];
  notFood: boolean;
  message?: string;
}

export interface CoachResponse {
  window: number;
  today: string;
  body: string;
  cached: boolean;
  ai?: boolean;
  findings?: {
    daysLogged: number; daysInWindow: number;
    avgKcal: number | null; avgProtein: number | null; avgFibre: number | null;
    targetKcal: number; targetProtein: number;
    trendChangeKg: number | null; predictedChangeKg: number | null;
    sessionsDone: number; sessionsPlanned: number;
    impliedTdee: number | null;
    notes: string[];
  };
  targets: Targets;
  planned: Projection;
  actual: Projection | null;
  days: { date: string; kcal: number; protein: number; carbs: number; fat: number; fibre: number }[];
  weights: { date: string; weightKg: number; trendKg: number }[];
  workouts: { date: string; name: string; sets: number; volumeKg: number }[];
  restDays: number;
  cheatDays: number;
}

export interface PhotosResponse {
  photos: (PhotoRow & { url: string | null })[];
  byPose: Record<string, (PhotoRow & { url: string | null })[]>;
  comparison: Record<string, { first: PhotoRow & { url: string | null }; latest: PhotoRow & { url: string | null } } | null>;
}
