/**
 * One canonical shape for food, whatever it came from.
 *
 * Everything is stored per 100 g, never per serving. Servings are a
 * presentation detail that differs between databases and between the front
 * and back of the same packet; per-100 g is the only figure that can be
 * scaled without introducing error. The UI multiplies at the last moment.
 */

export const EMPTY = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fibre: 0,
  sugar: 0,
  satFat: 0,
  sodium: 0,
};

/** Scale a per-100 g panel to an actual weight. */
export function forGrams(per100g, grams) {
  const f = grams / 100;
  return {
    kcal: r(per100g.kcal * f),
    protein: r(per100g.protein * f),
    carbs: r(per100g.carbs * f),
    fat: r(per100g.fat * f),
    fibre: r(per100g.fibre * f),
    sugar: r(per100g.sugar * f),
    satFat: r(per100g.satFat * f),
    sodium: Math.round(per100g.sodium * f),
  };
}

export function add(a, b) {
  return {
    kcal: r(a.kcal + b.kcal),
    protein: r(a.protein + b.protein),
    carbs: r(a.carbs + b.carbs),
    fat: r(a.fat + b.fat),
    fibre: r(a.fibre + b.fibre),
    sugar: r(a.sugar + b.sugar),
    satFat: r(a.satFat + b.satFat),
    sodium: Math.round(a.sodium + b.sodium),
  };
}

export const sum = (list) => list.reduce(add, EMPTY);

/**
 * Sanity-check a panel before it is trusted.
 *
 * Crowd-sourced entries contain typos — a chocolate bar filed as 8000 kcal
 * per 100 g, or macros that add to three times the stated calories. Atwater
 * factors let us check the arithmetic: if the macros do not roughly account
 * for the calories, one of the two is wrong and the entry is not usable.
 */
export function plausible(n) {
  if (!Number.isFinite(n.kcal) || n.kcal < 0 || n.kcal > 902) return false; // pure fat = 900
  for (const g of [n.protein, n.carbs, n.fat, n.fibre]) {
    if (!Number.isFinite(g) || g < 0 || g > 100) return false;
  }
  if (n.protein + n.carbs + n.fat > 105) return false;

  // Atwater: 4/4/9 kcal per gram. Fibre is counted at 2.
  const fromMacros = n.protein * 4 + (n.carbs - n.fibre) * 4 + n.fibre * 2 + n.fat * 9;
  if (n.kcal < 10 && fromMacros < 25) return true; // water, black coffee, spices
  const ratio = fromMacros / Math.max(n.kcal, 1);
  return ratio > 0.6 && ratio < 1.5;
}

const r = (n) => Math.round((Number.isFinite(n) ? n : 0) * 10) / 10;
