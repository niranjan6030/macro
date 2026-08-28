import { type Food, type Nutrients } from "./types";

/**
 * Indian staples, per 100 g as eaten.
 *
 * Neither of the remote sources covers this well. Open Food Facts only knows
 * packaged goods, and USDA's idea of "curry" is not dinner in Hyderabad. So
 * the everyday food — dal, roti, idli, biryani — is held here, drawn from the
 * Indian Food Composition Tables (NIN, 2017) and from standard recipe
 * proportions for the composite dishes.
 *
 * "As eaten" matters and is the usual source of large errors: 100 g of raw
 * rice becomes roughly 250 g cooked, so logging cooked rice against a raw
 * figure overstates it by about two and a half times. Everything below is
 * the cooked, served weight unless the name says otherwise.
 *
 * Composite dishes are marked `estimated` — a home biryani and a restaurant
 * biryani are not the same food, and the app says so rather than implying a
 * precision it does not have.
 */

interface Row {
  name: string;
  aliases?: string[];
  /** kcal, protein, carbs, fat, fibre — per 100 g as eaten. */
  n: [number, number, number, number, number];
  /** One typical portion in grams: one roti, one idli, one katori of dal. */
  unit?: [string, number];
  confidence?: "measured" | "estimated";
}

const ROWS: Row[] = [
  // --- Grains and breads, cooked -------------------------------------
  { name: "Rice, white, cooked", aliases: ["chawal", "steamed rice", "plain rice"], n: [130, 2.7, 28.2, 0.3, 0.4], unit: ["katori", 150] },
  { name: "Rice, brown, cooked", aliases: ["brown rice"], n: [123, 2.7, 25.6, 1.0, 1.8], unit: ["katori", 150] },
  { name: "Roti / chapati, wheat", aliases: ["roti", "chapati", "phulka"], n: [297, 9.6, 55.0, 4.2, 8.2], unit: ["roti", 40], confidence: "measured" },
  { name: "Paratha, plain", aliases: ["paratha"], n: [326, 7.4, 45.6, 12.8, 5.1], unit: ["paratha", 60], confidence: "estimated" },
  { name: "Naan", aliases: ["naan"], n: [310, 8.7, 52.0, 6.6, 2.3], unit: ["naan", 90], confidence: "estimated" },
  { name: "Puri", aliases: ["poori", "puri"], n: [420, 7.8, 46.0, 22.4, 4.4], unit: ["puri", 25], confidence: "estimated" },
  { name: "Idli", aliases: ["idli"], n: [132, 4.1, 26.0, 0.8, 1.3], unit: ["idli", 45], confidence: "measured" },
  { name: "Dosa, plain", aliases: ["dosa", "sada dosa"], n: [168, 3.9, 27.0, 4.9, 1.4], unit: ["dosa", 90], confidence: "estimated" },
  { name: "Upma", aliases: ["upma"], n: [155, 3.4, 22.0, 5.8, 1.7], unit: ["katori", 150], confidence: "estimated" },
  { name: "Poha", aliases: ["poha", "flattened rice cooked"], n: [148, 2.6, 26.4, 3.9, 1.2], unit: ["katori", 150], confidence: "estimated" },
  { name: "Oats, cooked in water", aliases: ["oats", "oatmeal", "porridge"], n: [71, 2.5, 12.0, 1.5, 1.7], unit: ["bowl", 250] },
  { name: "Bread, white", aliases: ["bread", "slice bread"], n: [265, 9.0, 49.0, 3.2, 2.7], unit: ["slice", 28] },
  { name: "Bread, brown / wholemeal", aliases: ["brown bread", "atta bread"], n: [247, 10.7, 41.0, 3.4, 6.8], unit: ["slice", 30] },

  // --- Pulses and legumes, cooked ------------------------------------
  { name: "Dal, toor / arhar, cooked", aliases: ["dal", "toor dal", "arhar dal", "tur dal"], n: [116, 6.8, 18.0, 1.9, 4.4], unit: ["katori", 150], confidence: "measured" },
  { name: "Dal, moong, cooked", aliases: ["moong dal", "mung dal"], n: [105, 7.0, 16.5, 1.2, 3.9], unit: ["katori", 150] },
  { name: "Dal, masoor, cooked", aliases: ["masoor dal", "red lentil"], n: [116, 9.0, 20.1, 0.4, 7.9], unit: ["katori", 150] },
  { name: "Rajma, cooked", aliases: ["rajma", "kidney beans"], n: [127, 8.7, 22.8, 0.5, 6.4], unit: ["katori", 150] },
  { name: "Chana, kabuli / chickpeas, cooked", aliases: ["chana", "chickpeas", "chole"], n: [164, 8.9, 27.4, 2.6, 7.6], unit: ["katori", 150] },
  { name: "Chana masala / chole, cooked dish", aliases: ["chole", "chana masala"], n: [154, 6.8, 20.1, 5.4, 5.8], unit: ["katori", 180], confidence: "estimated" },
  { name: "Sambar", aliases: ["sambar", "sambhar"], n: [85, 3.8, 11.2, 2.8, 3.1], unit: ["katori", 150], confidence: "estimated" },

  // --- Meat, fish, eggs -----------------------------------------------
  { name: "Chicken breast, skinless, cooked", aliases: ["chicken breast", "chicken"], n: [165, 31.0, 0, 3.6, 0], unit: ["piece", 120], confidence: "measured" },
  { name: "Chicken thigh, skinless, cooked", aliases: ["chicken thigh"], n: [209, 26.0, 0, 10.9, 0], unit: ["piece", 90] },
  { name: "Chicken curry", aliases: ["chicken curry", "chicken masala"], n: [180, 14.6, 5.2, 11.2, 1.1], unit: ["katori", 180], confidence: "estimated" },
  { name: "Mutton, cooked", aliases: ["mutton", "goat meat", "lamb"], n: [258, 25.6, 0, 16.9, 0], unit: ["katori", 120] },
  { name: "Egg, whole, boiled", aliases: ["egg", "boiled egg", "anda"], n: [155, 12.6, 1.1, 10.6, 0], unit: ["egg", 50], confidence: "measured" },
  { name: "Egg white, boiled", aliases: ["egg white"], n: [52, 10.9, 0.7, 0.2, 0], unit: ["white", 33] },
  { name: "Fish, rohu, cooked", aliases: ["rohu", "fish"], n: [136, 22.4, 0, 4.9, 0], unit: ["piece", 100] },
  { name: "Prawns, cooked", aliases: ["prawn", "shrimp"], n: [99, 24.0, 0.2, 0.3, 0], unit: ["katori", 100] },

  // --- Dairy -----------------------------------------------------------
  { name: "Milk, buffalo, whole", aliases: ["milk", "doodh", "buffalo milk"], n: [97, 3.8, 5.0, 6.5, 0], unit: ["glass", 200] },
  { name: "Milk, cow, toned", aliases: ["toned milk", "cow milk"], n: [58, 3.1, 4.7, 3.1, 0], unit: ["glass", 200] },
  { name: "Curd / dahi, whole milk", aliases: ["curd", "dahi", "yoghurt", "yogurt"], n: [61, 3.5, 4.7, 3.3, 0], unit: ["katori", 150] },
  { name: "Greek yoghurt, plain", aliases: ["greek yoghurt", "hung curd"], n: [59, 10.2, 3.6, 0.4, 0], unit: ["cup", 170] },
  { name: "Paneer", aliases: ["paneer", "cottage cheese"], n: [296, 18.9, 6.1, 22.1, 0], unit: ["cubes", 100], confidence: "measured" },
  { name: "Ghee", aliases: ["ghee", "clarified butter"], n: [900, 0, 0, 100, 0], unit: ["tsp", 5] },
  { name: "Butter", aliases: ["butter", "makhan"], n: [717, 0.9, 0.1, 81.1, 0], unit: ["tsp", 5] },
  { name: "Cheese, processed", aliases: ["cheese", "cheese slice"], n: [330, 20.0, 2.1, 26.6, 0], unit: ["slice", 20] },

  // --- Vegetables, cooked ----------------------------------------------
  { name: "Mixed vegetable sabzi", aliases: ["sabzi", "mixed veg"], n: [98, 2.4, 9.8, 5.6, 3.2], unit: ["katori", 150], confidence: "estimated" },
  { name: "Aloo sabzi / potato curry", aliases: ["aloo", "potato curry", "aloo sabzi"], n: [124, 2.1, 17.4, 5.3, 2.2], unit: ["katori", 150], confidence: "estimated" },
  { name: "Palak paneer", aliases: ["palak paneer", "saag paneer"], n: [180, 8.9, 6.2, 13.6, 2.4], unit: ["katori", 180], confidence: "estimated" },
  { name: "Bhindi / okra, cooked", aliases: ["bhindi", "okra", "lady finger"], n: [96, 2.1, 8.4, 6.2, 3.4], unit: ["katori", 150], confidence: "estimated" },
  { name: "Potato, boiled", aliases: ["potato", "aloo boiled"], n: [87, 1.9, 20.1, 0.1, 1.8], unit: ["medium", 130] },
  { name: "Cauliflower, cooked", aliases: ["gobi", "cauliflower"], n: [23, 1.8, 4.1, 0.5, 2.3], unit: ["katori", 150] },
  { name: "Spinach, cooked", aliases: ["palak", "spinach"], n: [23, 3.0, 3.8, 0.3, 2.4], unit: ["katori", 150] },

  // --- Fruit -----------------------------------------------------------
  { name: "Banana", aliases: ["banana", "kela"], n: [89, 1.1, 22.8, 0.3, 2.6], unit: ["medium", 118], confidence: "measured" },
  { name: "Apple", aliases: ["apple", "seb"], n: [52, 0.3, 13.8, 0.2, 2.4], unit: ["medium", 182] },
  { name: "Mango", aliases: ["mango", "aam"], n: [60, 0.8, 15.0, 0.4, 1.6], unit: ["medium", 200] },
  { name: "Orange", aliases: ["orange", "santra"], n: [47, 0.9, 11.8, 0.1, 2.4], unit: ["medium", 131] },
  { name: "Papaya", aliases: ["papaya", "papita"], n: [43, 0.5, 10.8, 0.3, 1.7], unit: ["katori", 145] },
  { name: "Guava", aliases: ["guava", "amrud"], n: [68, 2.6, 14.3, 1.0, 5.4], unit: ["medium", 100] },
  { name: "Watermelon", aliases: ["watermelon", "tarbooj"], n: [30, 0.6, 7.6, 0.2, 0.4], unit: ["slice", 280] },

  // --- Nuts, seeds, oils ------------------------------------------------
  { name: "Almonds", aliases: ["almond", "badam"], n: [579, 21.2, 21.6, 49.9, 12.5], unit: ["10 pieces", 12], confidence: "measured" },
  { name: "Peanuts, roasted", aliases: ["peanut", "moongphali", "groundnut"], n: [567, 25.8, 16.1, 49.2, 8.5], unit: ["handful", 30] },
  { name: "Walnuts", aliases: ["walnut", "akhrot"], n: [654, 15.2, 13.7, 65.2, 6.7], unit: ["4 halves", 15] },
  { name: "Cashews", aliases: ["cashew", "kaju"], n: [553, 18.2, 30.2, 43.9, 3.3], unit: ["10 pieces", 15] },
  { name: "Peanut butter", aliases: ["peanut butter"], n: [588, 25.1, 19.6, 50.4, 6.0], unit: ["tbsp", 16] },
  { name: "Cooking oil (any)", aliases: ["oil", "sunflower oil", "mustard oil", "tel"], n: [884, 0, 0, 100, 0], unit: ["tbsp", 14], confidence: "measured" },

  // --- Snacks and sweets -------------------------------------------------
  { name: "Samosa", aliases: ["samosa"], n: [308, 5.3, 32.0, 17.9, 2.8], unit: ["piece", 60], confidence: "estimated" },
  { name: "Pakora / bhaji", aliases: ["pakora", "bhajji", "bhaji"], n: [315, 7.2, 28.4, 19.1, 3.6], unit: ["piece", 30], confidence: "estimated" },
  { name: "Gulab jamun", aliases: ["gulab jamun"], n: [312, 4.1, 43.0, 14.1, 0.5], unit: ["piece", 45], confidence: "estimated" },
  { name: "Jalebi", aliases: ["jalebi"], n: [386, 2.6, 58.0, 15.8, 0.3], unit: ["piece", 30], confidence: "estimated" },
  { name: "Biryani, chicken", aliases: ["biryani", "chicken biryani"], n: [186, 9.4, 22.1, 6.8, 1.2], unit: ["plate", 350], confidence: "estimated" },
  { name: "Biryani, vegetable", aliases: ["veg biryani"], n: [168, 3.9, 26.4, 5.3, 1.9], unit: ["plate", 350], confidence: "estimated" },

  // --- Drinks -------------------------------------------------------------
  { name: "Tea with milk and sugar", aliases: ["chai", "tea"], n: [52, 1.3, 8.2, 1.5, 0], unit: ["cup", 150], confidence: "estimated" },
  { name: "Coffee with milk and sugar", aliases: ["coffee"], n: [56, 1.4, 8.6, 1.7, 0], unit: ["cup", 150], confidence: "estimated" },
  { name: "Tea / coffee, black, no sugar", aliases: ["black coffee", "black tea", "green tea"], n: [1, 0.1, 0.2, 0, 0], unit: ["cup", 200] },
  { name: "Lassi, sweet", aliases: ["lassi"], n: [92, 2.6, 14.8, 2.6, 0], unit: ["glass", 250], confidence: "estimated" },
  { name: "Cola, regular", aliases: ["cola", "soft drink", "coke", "pepsi"], n: [42, 0, 10.6, 0, 0], unit: ["can", 330] },
  { name: "Whey protein powder", aliases: ["whey", "protein powder"], n: [380, 76.0, 8.0, 4.5, 1.0], unit: ["scoop", 30] },
];

/** Sodium and sugar are not carried in the table; they are set to 0 rather
 *  than guessed, and the UI shows them as unknown rather than as zero. */
function nutrients(r: Row): Nutrients {
  const [kcal, protein, carbs, fat, fibre] = r.n;
  return { kcal, protein, carbs, fat, fibre, sugar: 0, satFat: 0, sodium: 0 };
}

export const FOODS: Food[] = ROWS.map((r, i) => ({
  id: `in:${i}`,
  source: "custom",
  name: r.name,
  brand: null,
  per100g: nutrients(r),
  servingG: r.unit?.[1] ?? null,
  servingLabel: r.unit ? `1 ${r.unit[0]}` : null,
  confidence: r.confidence ?? "estimated",
}));

const INDEX = ROWS.map((r, i) => ({
  food: FOODS[i],
  terms: [r.name.toLowerCase(), ...(r.aliases ?? [])],
}));

/** Substring match over names and aliases, best match first. */
export function search(query: string, limit = 8): Food[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: { food: Food; score: number }[] = [];
  for (const { food, terms } of INDEX) {
    let best = 0;
    for (const t of terms) {
      if (t === q) best = Math.max(best, 100);
      else if (t.startsWith(q)) best = Math.max(best, 80);
      else if (t.includes(q)) best = Math.max(best, 55);
    }
    if (best > 0) hits.push({ food, score: best });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit).map((h) => h.food);
}

export const byId = (id: string): Food | null =>
  FOODS.find((f) => f.id === id) ?? null;
