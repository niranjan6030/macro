import { withUser, ok, fail, body, num, str, oneOf } from "@/lib/api";
import { addDiaryEntry, deleteDiaryEntry, listDiary, isoDate, type Meal } from "@/lib/db";
import { forGrams, plausible, type Nutrients } from "@/lib/nutrition/types";
import { resolve } from "@/lib/nutrition/search";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
const SOURCES = ["openfoodfacts", "usda", "custom", "estimate", "photo"] as const;

export const GET = withUser(async (uid, req) => {
  const date = isoDate(new URL(req.url).searchParams.get("date"));
  return ok({ date, entries: await listDiary(uid, date) });
});

/**
 * Log something.
 *
 * Two ways in. Either a `source` and `source_id`, in which case the panel is
 * fetched server-side and the client cannot influence the numbers — this is
 * the path everything in the UI uses. Or an explicit `per_100g`, for a food
 * the person entered by hand off a wrapper.
 *
 * What is never accepted is a pre-computed `nutrients` total from the
 * client. The scaling happens here, from a per-100 g panel and a weight, so
 * there is one place where that multiplication can be wrong.
 */
export const POST = withUser(async (uid, req) => {
  const b = await body(req);

  const grams = num(b.grams, 0.1, 5000);
  if (grams == null) return fail("Enter a weight in grams.");

  const meal = oneOf(b.meal, MEALS) ?? guessMeal();
  const date = isoDate(b.date);

  let per100g: Nutrients | null = null;
  let name = str(b.name, 160);
  let brand = str(b.brand, 80);
  let confidence: string | null = null;
  let source = oneOf(b.source, SOURCES) ?? "custom";
  const sourceId = str(b.source_id, 120);

  if (sourceId && (source === "openfoodfacts" || source === "usda" || source === "custom")) {
    const food = await resolve(source, sourceId);
    if (!food) return fail("That food could not be found. Try searching again.", 404);
    per100g = food.per100g;
    name ??= food.name;
    brand ??= food.brand ?? null;
    confidence = food.confidence;
  } else if (b.per_100g && typeof b.per_100g === "object") {
    per100g = normalise(b.per_100g as Record<string, unknown>);
    if (!plausible(per100g)) {
      return fail("Those numbers do not add up — check the panel and try again.");
    }
    confidence = "label";
    source = source === "photo" ? "photo" : "custom";
  }

  if (!per100g) return fail("Choose a food, or enter its nutrition panel.");
  if (!name) return fail("Give it a name.");

  const entry = await addDiaryEntry(uid, {
    on_date: date,
    meal: meal as Meal,
    name,
    brand,
    grams,
    source,
    source_id: sourceId,
    confidence,
    nutrients: forGrams(per100g, grams),
    per_100g: per100g,
    photo_path: str(b.photo_path, 300),
  });

  return ok({ entry });
});

export const DELETE = withUser(async (uid, req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Which entry?");
  return (await deleteDiaryEntry(uid, id))
    ? ok({ deleted: true })
    : fail("That entry is not there.", 404);
});

/** Meal from the clock, so logging a snack at 8am does not need a tap. */
function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 22) return "dinner";
  return "snack";
}

function normalise(raw: Record<string, unknown>): Nutrients {
  const n = (k: string) => {
    const v = raw[k];
    const x = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : 0;
    return Number.isFinite(x) && x >= 0 ? x : 0;
  };
  return {
    kcal: n("kcal"), protein: n("protein"), carbs: n("carbs"), fat: n("fat"),
    fibre: n("fibre"), sugar: n("sugar"), satFat: n("satFat"), sodium: n("sodium"),
  };
}
