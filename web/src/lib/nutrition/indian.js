import {} from "./types";

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

const ROWS = [
  // --- Grains and breads, cooked -------------------------------------
  {
    name: "Rice, white, cooked",
    aliases: ["chawal", "steamed rice", "plain rice"],
    n: [130, 2.7, 28.2, 0.3, 0.4],
    unit: ["katori", 150],
  },
  {
    name: "Rice, brown, cooked",
    aliases: ["brown rice"],
    n: [123, 2.7, 25.6, 1.0, 1.8],
    unit: ["katori", 150],
  },
  {
    name: "Roti / chapati, wheat",
    aliases: ["roti", "chapati", "phulka"],
    n: [297, 9.6, 55.0, 4.2, 8.2],
    unit: ["roti", 40],
    confidence: "measured",
  },
  {
    name: "Paratha, plain",
    aliases: ["paratha"],
    n: [326, 7.4, 45.6, 12.8, 5.1],
    unit: ["paratha", 60],
    confidence: "estimated",
  },
  {
    name: "Naan",
    aliases: ["naan"],
    n: [310, 8.7, 52.0, 6.6, 2.3],
    unit: ["naan", 90],
    confidence: "estimated",
  },
  {
    name: "Puri",
    aliases: ["poori", "puri"],
    n: [420, 7.8, 46.0, 22.4, 4.4],
    unit: ["puri", 25],
    confidence: "estimated",
  },
  {
    name: "Idli",
    aliases: ["idli"],
    n: [132, 4.1, 26.0, 0.8, 1.3],
    unit: ["idli", 45],
    confidence: "measured",
  },
  {
    name: "Dosa, plain",
    aliases: ["dosa", "sada dosa"],
    n: [168, 3.9, 27.0, 4.9, 1.4],
    unit: ["dosa", 90],
    confidence: "estimated",
  },
  {
    name: "Upma",
    aliases: ["upma"],
    n: [155, 3.4, 22.0, 5.8, 1.7],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Poha",
    aliases: ["poha", "flattened rice cooked"],
    n: [148, 2.6, 26.4, 3.9, 1.2],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Oats, cooked in water",
    aliases: ["oats", "oatmeal", "porridge"],
    n: [71, 2.5, 12.0, 1.5, 1.7],
    unit: ["bowl", 250],
  },
  {
    name: "Bread, white",
    aliases: ["bread", "slice bread"],
    n: [265, 9.0, 49.0, 3.2, 2.7],
    unit: ["slice", 28],
  },
  {
    name: "Bread, brown / wholemeal",
    aliases: ["brown bread", "atta bread"],
    n: [247, 10.7, 41.0, 3.4, 6.8],
    unit: ["slice", 30],
  },

  // --- Pulses and legumes, cooked ------------------------------------
  {
    name: "Dal, toor / arhar, cooked",
    aliases: ["dal", "toor dal", "arhar dal", "tur dal"],
    n: [116, 6.8, 18.0, 1.9, 4.4],
    unit: ["katori", 150],
    confidence: "measured",
  },
  {
    name: "Dal, moong, cooked",
    aliases: ["moong dal", "mung dal"],
    n: [105, 7.0, 16.5, 1.2, 3.9],
    unit: ["katori", 150],
  },
  {
    name: "Dal, masoor, cooked",
    aliases: ["masoor dal", "red lentil"],
    n: [116, 9.0, 20.1, 0.4, 7.9],
    unit: ["katori", 150],
  },
  {
    name: "Rajma, cooked",
    aliases: ["rajma", "kidney beans"],
    n: [127, 8.7, 22.8, 0.5, 6.4],
    unit: ["katori", 150],
  },
  {
    name: "Chana, kabuli / chickpeas, cooked",
    aliases: ["chana", "chickpeas", "chole"],
    n: [164, 8.9, 27.4, 2.6, 7.6],
    unit: ["katori", 150],
  },
  {
    name: "Chana masala / chole, cooked dish",
    aliases: ["chole", "chana masala"],
    n: [154, 6.8, 20.1, 5.4, 5.8],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Sambar",
    aliases: ["sambar", "sambhar"],
    n: [85, 3.8, 11.2, 2.8, 3.1],
    unit: ["katori", 150],
    confidence: "estimated",
  },

  // --- Meat, fish, eggs -----------------------------------------------
  {
    name: "Chicken breast, skinless, cooked",
    aliases: ["chicken breast", "chicken"],
    n: [165, 31.0, 0, 3.6, 0],
    unit: ["piece", 120],
    confidence: "measured",
  },
  {
    name: "Chicken thigh, skinless, cooked",
    aliases: ["chicken thigh"],
    n: [209, 26.0, 0, 10.9, 0],
    unit: ["piece", 90],
  },
  {
    name: "Chicken curry",
    aliases: ["chicken curry", "chicken masala"],
    n: [180, 14.6, 5.2, 11.2, 1.1],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Mutton, cooked",
    aliases: ["mutton", "goat meat", "lamb"],
    n: [258, 25.6, 0, 16.9, 0],
    unit: ["katori", 120],
  },
  {
    name: "Egg, whole, boiled",
    aliases: ["egg", "boiled egg", "anda"],
    n: [155, 12.6, 1.1, 10.6, 0],
    unit: ["egg", 50],
    confidence: "measured",
  },
  {
    name: "Egg white, boiled",
    aliases: ["egg white"],
    n: [52, 10.9, 0.7, 0.2, 0],
    unit: ["white", 33],
  },
  {
    name: "Fish, rohu, cooked",
    aliases: ["rohu", "fish"],
    n: [136, 22.4, 0, 4.9, 0],
    unit: ["piece", 100],
  },
  {
    name: "Prawns, cooked",
    aliases: ["prawn", "shrimp"],
    n: [99, 24.0, 0.2, 0.3, 0],
    unit: ["katori", 100],
  },

  // --- Dairy -----------------------------------------------------------
  {
    name: "Milk, buffalo, whole",
    aliases: ["milk", "doodh", "buffalo milk"],
    n: [97, 3.8, 5.0, 6.5, 0],
    unit: ["glass", 200],
  },
  {
    name: "Milk, cow, toned",
    aliases: ["toned milk", "cow milk"],
    n: [58, 3.1, 4.7, 3.1, 0],
    unit: ["glass", 200],
  },
  {
    name: "Curd / dahi, whole milk",
    aliases: ["curd", "dahi", "yoghurt", "yogurt"],
    n: [61, 3.5, 4.7, 3.3, 0],
    unit: ["katori", 150],
  },
  {
    name: "Greek yoghurt, plain",
    aliases: ["greek yoghurt", "hung curd"],
    n: [59, 10.2, 3.6, 0.4, 0],
    unit: ["cup", 170],
  },
  {
    name: "Paneer",
    aliases: ["paneer", "cottage cheese"],
    n: [296, 18.9, 6.1, 22.1, 0],
    unit: ["cubes", 100],
    confidence: "measured",
  },
  { name: "Ghee", aliases: ["ghee", "clarified butter"], n: [900, 0, 0, 100, 0], unit: ["tsp", 5] },
  { name: "Butter", aliases: ["butter", "makhan"], n: [717, 0.9, 0.1, 81.1, 0], unit: ["tsp", 5] },
  {
    name: "Cheese, processed",
    aliases: ["cheese", "cheese slice"],
    n: [330, 20.0, 2.1, 26.6, 0],
    unit: ["slice", 20],
  },

  // --- Vegetables, cooked ----------------------------------------------
  {
    name: "Mixed vegetable sabzi",
    aliases: ["sabzi", "mixed veg"],
    n: [98, 2.4, 9.8, 5.6, 3.2],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Aloo sabzi / potato curry",
    aliases: ["aloo", "potato curry", "aloo sabzi"],
    n: [124, 2.1, 17.4, 5.3, 2.2],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Palak paneer",
    aliases: ["palak paneer", "saag paneer"],
    n: [180, 8.9, 6.2, 13.6, 2.4],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Bhindi / okra, cooked",
    aliases: ["bhindi", "okra", "lady finger"],
    n: [96, 2.1, 8.4, 6.2, 3.4],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Potato, boiled",
    aliases: ["potato", "aloo boiled"],
    n: [87, 1.9, 20.1, 0.1, 1.8],
    unit: ["medium", 130],
  },
  {
    name: "Cauliflower, cooked",
    aliases: ["gobi", "cauliflower"],
    n: [23, 1.8, 4.1, 0.5, 2.3],
    unit: ["katori", 150],
  },
  {
    name: "Spinach, cooked",
    aliases: ["palak", "spinach"],
    n: [23, 3.0, 3.8, 0.3, 2.4],
    unit: ["katori", 150],
  },

  // --- Fruit -----------------------------------------------------------
  {
    name: "Banana",
    aliases: ["banana", "kela"],
    n: [89, 1.1, 22.8, 0.3, 2.6],
    unit: ["medium", 118],
    confidence: "measured",
  },
  { name: "Apple", aliases: ["apple", "seb"], n: [52, 0.3, 13.8, 0.2, 2.4], unit: ["medium", 182] },
  { name: "Mango", aliases: ["mango", "aam"], n: [60, 0.8, 15.0, 0.4, 1.6], unit: ["medium", 200] },
  {
    name: "Orange",
    aliases: ["orange", "santra"],
    n: [47, 0.9, 11.8, 0.1, 2.4],
    unit: ["medium", 131],
  },
  {
    name: "Papaya",
    aliases: ["papaya", "papita"],
    n: [43, 0.5, 10.8, 0.3, 1.7],
    unit: ["katori", 145],
  },
  {
    name: "Guava",
    aliases: ["guava", "amrud"],
    n: [68, 2.6, 14.3, 1.0, 5.4],
    unit: ["medium", 100],
  },
  {
    name: "Watermelon",
    aliases: ["watermelon", "tarbooj"],
    n: [30, 0.6, 7.6, 0.2, 0.4],
    unit: ["slice", 280],
  },

  // --- Nuts, seeds, oils ------------------------------------------------
  {
    name: "Almonds",
    aliases: ["almond", "badam"],
    n: [579, 21.2, 21.6, 49.9, 12.5],
    unit: ["10 pieces", 12],
    confidence: "measured",
  },
  {
    name: "Peanuts, roasted",
    aliases: ["peanut", "moongphali", "groundnut"],
    n: [567, 25.8, 16.1, 49.2, 8.5],
    unit: ["handful", 30],
  },
  {
    name: "Walnuts",
    aliases: ["walnut", "akhrot"],
    n: [654, 15.2, 13.7, 65.2, 6.7],
    unit: ["4 halves", 15],
  },
  {
    name: "Cashews",
    aliases: ["cashew", "kaju"],
    n: [553, 18.2, 30.2, 43.9, 3.3],
    unit: ["10 pieces", 15],
  },
  {
    name: "Peanut butter",
    aliases: ["peanut butter"],
    n: [588, 25.1, 19.6, 50.4, 6.0],
    unit: ["tbsp", 16],
  },
  {
    name: "Cooking oil (any)",
    aliases: ["oil", "sunflower oil", "mustard oil", "tel"],
    n: [884, 0, 0, 100, 0],
    unit: ["tbsp", 14],
    confidence: "measured",
  },

  // --- Snacks and sweets -------------------------------------------------
  {
    name: "Samosa",
    aliases: ["samosa"],
    n: [308, 5.3, 32.0, 17.9, 2.8],
    unit: ["piece", 60],
    confidence: "estimated",
  },
  {
    name: "Pakora / bhaji",
    aliases: ["pakora", "bhajji", "bhaji"],
    n: [315, 7.2, 28.4, 19.1, 3.6],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Gulab jamun",
    aliases: ["gulab jamun"],
    n: [312, 4.1, 43.0, 14.1, 0.5],
    unit: ["piece", 45],
    confidence: "estimated",
  },
  {
    name: "Jalebi",
    aliases: ["jalebi"],
    n: [386, 2.6, 58.0, 15.8, 0.3],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Biryani, chicken",
    aliases: ["biryani", "chicken biryani"],
    n: [186, 9.4, 22.1, 6.8, 1.2],
    unit: ["plate", 350],
    confidence: "estimated",
  },
  {
    name: "Biryani, vegetable",
    aliases: ["veg biryani"],
    n: [168, 3.9, 26.4, 5.3, 1.9],
    unit: ["plate", 350],
    confidence: "estimated",
  },

  // --- Drinks -------------------------------------------------------------
  {
    name: "Tea with milk and sugar",
    aliases: ["chai", "tea"],
    n: [52, 1.3, 8.2, 1.5, 0],
    unit: ["cup", 150],
    confidence: "estimated",
  },
  {
    name: "Coffee with milk and sugar",
    aliases: ["coffee"],
    n: [56, 1.4, 8.6, 1.7, 0],
    unit: ["cup", 150],
    confidence: "estimated",
  },
  {
    name: "Tea / coffee, black, no sugar",
    aliases: ["black coffee", "black tea", "green tea"],
    n: [1, 0.1, 0.2, 0, 0],
    unit: ["cup", 200],
  },
  {
    name: "Lassi, sweet",
    aliases: ["lassi"],
    n: [92, 2.6, 14.8, 2.6, 0],
    unit: ["glass", 250],
    confidence: "estimated",
  },
  {
    name: "Cola, regular",
    aliases: ["cola", "soft drink", "coke", "pepsi"],
    n: [42, 0, 10.6, 0, 0],
    unit: ["can", 330],
  },
  {
    name: "Whey protein powder",
    aliases: ["whey", "protein powder"],
    n: [380, 76.0, 8.0, 4.5, 1.0],
    unit: ["scoop", 30],
  },

  // =====================================================================
  // The second pass.
  //
  // Everything above is what a first version needs. Everything below is
  // what someone hits in the second week — "rice" is not one food, dinner
  // is as often noodles as it is dal, and the sixty-eight rows above have
  // no answer for a pear.
  //
  // Same rules as above: cooked and served weights, composite dishes
  // marked estimated, total carbohydrate with fibre counted inside it.
  // =====================================================================

  // --- More grains, breads and rice dishes ------------------------------
  {
    name: "Rice, basmati, cooked",
    aliases: ["basmati", "basmati rice"],
    n: [121, 2.5, 26.0, 0.4, 0.5],
    unit: ["katori", 150],
  },
  {
    name: "Jeera rice",
    aliases: ["jeera rice", "cumin rice"],
    n: [165, 3.0, 27.0, 5.0, 0.6],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Curd rice",
    aliases: ["curd rice", "thayir sadam"],
    n: [120, 3.2, 19.0, 3.2, 0.5],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Lemon rice",
    aliases: ["lemon rice", "chitranna"],
    n: [175, 3.0, 27.0, 6.0, 1.0],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Pulao, vegetable",
    aliases: ["pulao", "pilaf", "veg pulao"],
    n: [155, 3.4, 25.0, 4.5, 1.5],
    unit: ["plate", 250],
    confidence: "estimated",
  },
  {
    name: "Khichdi",
    aliases: ["khichdi", "khichri"],
    n: [120, 4.5, 19.0, 2.8, 1.6],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Fried rice, vegetable",
    aliases: ["fried rice", "veg fried rice"],
    n: [165, 3.5, 26.0, 5.0, 1.4],
    unit: ["plate", 250],
    confidence: "estimated",
  },
  {
    name: "Bhatura",
    aliases: ["bhature", "bhatura"],
    n: [350, 8.0, 47.0, 14.0, 2.2],
    unit: ["piece", 80],
    confidence: "estimated",
  },
  {
    name: "Thepla",
    aliases: ["thepla"],
    n: [320, 8.0, 44.0, 12.5, 5.5],
    unit: ["piece", 45],
    confidence: "estimated",
  },
  {
    name: "Missi roti",
    aliases: ["missi roti"],
    n: [300, 11.0, 48.0, 7.0, 7.0],
    unit: ["roti", 50],
    confidence: "estimated",
  },
  {
    name: "Bajra roti",
    aliases: ["bajra roti", "pearl millet roti"],
    n: [290, 8.5, 52.0, 5.5, 9.0],
    unit: ["roti", 45],
    confidence: "measured",
  },
  {
    name: "Jowar roti",
    aliases: ["jowar roti", "bhakri", "sorghum roti"],
    n: [285, 8.0, 55.0, 3.5, 7.5],
    unit: ["roti", 45],
    confidence: "measured",
  },
  {
    name: "Ragi mudde / finger millet",
    aliases: ["ragi", "mudde", "finger millet"],
    n: [120, 2.8, 25.0, 0.6, 3.0],
    unit: ["ball", 150],
    confidence: "measured",
  },
  {
    name: "Appam",
    aliases: ["appam"],
    n: [145, 2.6, 29.0, 2.2, 0.8],
    unit: ["appam", 60],
    confidence: "estimated",
  },
  {
    name: "Uttapam",
    aliases: ["uttapam", "uthappam"],
    n: [165, 4.2, 27.0, 4.4, 1.6],
    unit: ["piece", 100],
    confidence: "estimated",
  },
  {
    name: "Dosa, masala",
    aliases: ["masala dosa"],
    n: [190, 4.0, 28.0, 6.8, 2.2],
    unit: ["dosa", 150],
    confidence: "estimated",
  },
  {
    name: "Dosa, rava",
    aliases: ["rava dosa"],
    n: [240, 4.5, 33.0, 10.0, 1.5],
    unit: ["dosa", 110],
    confidence: "estimated",
  },
  {
    name: "Vada, medu",
    aliases: ["vada", "medu vada"],
    n: [290, 8.5, 33.0, 14.0, 3.5],
    unit: ["vada", 45],
    confidence: "estimated",
  },
  {
    name: "Upma, vermicelli",
    aliases: ["semiya upma", "vermicelli upma"],
    n: [165, 3.6, 26.0, 5.0, 1.2],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Pasta, cooked",
    aliases: ["pasta", "spaghetti", "macaroni"],
    n: [158, 5.8, 31.0, 0.9, 1.8],
    unit: ["bowl", 200],
  },
  {
    name: "Noodles, instant, cooked",
    aliases: ["maggi", "instant noodles", "ramen"],
    n: [190, 4.3, 26.0, 7.5, 1.5],
    unit: ["pack", 150],
    confidence: "estimated",
  },
  {
    name: "Hakka noodles",
    aliases: ["hakka noodles", "chow mein", "chowmein"],
    n: [190, 5.0, 28.0, 6.5, 2.0],
    unit: ["plate", 250],
    confidence: "estimated",
  },
  {
    name: "Quinoa, cooked",
    aliases: ["quinoa"],
    n: [120, 4.4, 21.3, 1.9, 2.8],
    unit: ["katori", 150],
  },
  {
    name: "Couscous, cooked",
    aliases: ["couscous"],
    n: [112, 3.8, 23.2, 0.2, 1.4],
    unit: ["katori", 150],
  },
  {
    name: "Cornflakes",
    aliases: ["cornflakes", "corn flakes"],
    n: [378, 7.5, 84.0, 0.9, 3.3],
    unit: ["bowl", 40],
  },
  {
    name: "Muesli",
    aliases: ["muesli", "granola"],
    n: [375, 9.5, 66.0, 8.0, 7.5],
    unit: ["bowl", 50],
  },

  // --- More pulses, legumes and plant protein ----------------------------
  {
    name: "Dal, chana, cooked",
    aliases: ["chana dal"],
    n: [130, 7.0, 20.0, 2.5, 5.0],
    unit: ["katori", 150],
    confidence: "measured",
  },
  {
    name: "Dal, urad, cooked",
    aliases: ["urad dal"],
    n: [125, 7.5, 18.0, 2.2, 4.5],
    unit: ["katori", 150],
    confidence: "measured",
  },
  {
    name: "Dal makhani",
    aliases: ["dal makhani"],
    n: [180, 7.0, 17.0, 9.0, 5.0],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Dal tadka / fry",
    aliases: ["dal tadka", "dal fry"],
    n: [120, 6.0, 15.0, 4.0, 3.5],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Lobia / black-eyed peas, cooked",
    aliases: ["lobia", "black eyed peas", "chawli"],
    n: [116, 7.7, 20.8, 0.5, 6.5],
    unit: ["katori", 150],
  },
  {
    name: "Green peas, cooked",
    aliases: ["matar", "peas"],
    n: [84, 5.4, 15.6, 0.4, 5.5],
    unit: ["katori", 120],
  },
  {
    name: "Sprouts, moong, raw",
    aliases: ["sprouts", "moong sprouts"],
    n: [30, 3.0, 5.9, 0.2, 1.8],
    unit: ["katori", 100],
  },
  {
    name: "Soya chunks, cooked",
    aliases: ["soya chunks", "nutrela", "meal maker"],
    n: [145, 17.0, 12.0, 0.8, 6.0],
    unit: ["katori", 100],
    confidence: "estimated",
  },
  {
    name: "Tofu",
    aliases: ["tofu", "bean curd"],
    n: [76, 8.1, 1.9, 4.8, 0.3],
    unit: ["piece", 100],
  },
  {
    name: "Kadhi",
    aliases: ["kadhi"],
    n: [95, 3.5, 8.0, 5.5, 0.8],
    unit: ["katori", 180],
    confidence: "estimated",
  },

  // --- More meat, fish and eggs ------------------------------------------
  {
    name: "Chicken leg, with skin, cooked",
    aliases: ["chicken leg", "drumstick chicken"],
    n: [215, 25.0, 0, 12.5, 0],
    unit: ["leg", 110],
  },
  {
    name: "Chicken tikka",
    aliases: ["chicken tikka", "tandoori chicken"],
    n: [195, 27.0, 3.0, 8.0, 0.4],
    unit: ["plate", 150],
    confidence: "estimated",
  },
  {
    name: "Butter chicken",
    aliases: ["butter chicken", "murgh makhani"],
    n: [240, 15.0, 7.0, 17.0, 0.9],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Mutton curry",
    aliases: ["mutton curry", "lamb curry", "rogan josh"],
    n: [210, 16.0, 4.0, 14.5, 0.6],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Keema",
    aliases: ["keema", "mince curry"],
    n: [230, 18.0, 3.5, 16.0, 0.5],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Fish curry",
    aliases: ["fish curry", "meen curry"],
    n: [130, 13.0, 4.0, 6.5, 0.7],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Fish, pomfret, cooked",
    aliases: ["pomfret"],
    n: [130, 21.0, 0, 5.0, 0],
    unit: ["fillet", 120],
  },
  {
    name: "Fish, salmon, cooked",
    aliases: ["salmon"],
    n: [208, 22.1, 0, 13.4, 0],
    unit: ["fillet", 120],
  },
  {
    name: "Tuna, canned in water",
    aliases: ["tuna", "canned tuna"],
    n: [116, 25.5, 0, 0.8, 0],
    unit: ["tin", 95],
  },
  { name: "Egg, fried", aliases: ["fried egg"], n: [196, 13.6, 0.8, 15.3, 0], unit: ["egg", 46] },
  {
    name: "Omelette",
    aliases: ["omelette", "omelet", "anda bhurji", "scrambled egg"],
    n: [175, 11.0, 1.5, 14.0, 0.2],
    unit: ["two eggs", 120],
    confidence: "estimated",
  },
  { name: "Pork, cooked", aliases: ["pork"], n: [242, 27.3, 0, 14.0, 0], unit: ["portion", 100] },
  {
    name: "Beef, cooked",
    aliases: ["beef", "steak"],
    n: [250, 26.0, 0, 15.4, 0],
    unit: ["portion", 100],
  },

  // --- More dairy ---------------------------------------------------------
  {
    name: "Milk, cow, whole",
    aliases: ["full cream milk", "whole milk"],
    n: [67, 3.2, 4.8, 4.0, 0],
    unit: ["glass", 200],
  },
  {
    name: "Milk, skimmed",
    aliases: ["skimmed milk", "double toned milk"],
    n: [35, 3.4, 5.0, 0.2, 0],
    unit: ["glass", 200],
  },
  {
    name: "Curd, low fat",
    aliases: ["low fat curd", "low fat yoghurt"],
    n: [60, 3.5, 4.7, 2.5, 0],
    unit: ["katori", 150],
  },
  {
    name: "Buttermilk / chaas",
    aliases: ["chaas", "buttermilk", "majjige"],
    n: [30, 1.6, 3.5, 0.9, 0],
    unit: ["glass", 200],
  },
  {
    name: "Cheese, cheddar",
    aliases: ["cheddar"],
    n: [402, 25.0, 1.3, 33.0, 0],
    unit: ["slice", 20],
  },
  {
    name: "Cheese, mozzarella",
    aliases: ["mozzarella"],
    n: [300, 22.0, 2.2, 22.0, 0],
    unit: ["portion", 30],
  },
  {
    name: "Khoya / mawa",
    aliases: ["khoya", "mawa"],
    n: [420, 14.5, 25.0, 30.0, 0],
    unit: ["portion", 50],
    confidence: "estimated",
  },
  {
    name: "Cream, fresh",
    aliases: ["cream", "malai"],
    n: [292, 2.5, 3.5, 30.0, 0],
    unit: ["tbsp", 15],
  },
  {
    name: "Condensed milk",
    aliases: ["condensed milk", "milkmaid"],
    n: [321, 7.9, 54.4, 8.7, 0],
    unit: ["tbsp", 20],
  },
  {
    name: "Ice cream, vanilla",
    aliases: ["ice cream"],
    n: [207, 3.5, 24.0, 11.0, 0.7],
    unit: ["scoop", 60],
  },

  // --- More vegetables and vegetable dishes -------------------------------
  {
    name: "Baingan bharta",
    aliases: ["baingan bharta", "brinjal"],
    n: [105, 2.0, 8.0, 7.0, 3.5],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Aloo gobi",
    aliases: ["aloo gobi"],
    n: [110, 2.5, 12.0, 6.0, 3.0],
    unit: ["katori", 180],
    confidence: "estimated",
  },
  {
    name: "Bhindi masala",
    aliases: ["bhindi masala"],
    n: [115, 2.2, 9.5, 7.5, 4.0],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Pav bhaji, bhaji only",
    aliases: ["pav bhaji", "bhaji"],
    n: [120, 2.5, 14.0, 6.5, 3.5],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Manchurian, gobi",
    aliases: ["manchurian", "gobi manchurian"],
    n: [200, 4.0, 24.0, 10.0, 2.5],
    unit: ["plate", 200],
    confidence: "estimated",
  },
  {
    name: "Carrot, raw",
    aliases: ["carrot", "gajar"],
    n: [41, 0.9, 9.6, 0.2, 2.8],
    unit: ["carrot", 60],
  },
  {
    name: "Cucumber, raw",
    aliases: ["cucumber", "kheera"],
    n: [15, 0.7, 3.6, 0.1, 0.5],
    unit: ["cucumber", 150],
  },
  {
    name: "Tomato, raw",
    aliases: ["tomato", "tamatar"],
    n: [18, 0.9, 3.9, 0.2, 1.2],
    unit: ["tomato", 100],
  },
  {
    name: "Onion, raw",
    aliases: ["onion", "pyaz"],
    n: [40, 1.1, 9.3, 0.1, 1.7],
    unit: ["onion", 110],
  },
  {
    name: "Cabbage, cooked",
    aliases: ["cabbage", "patta gobi"],
    n: [23, 1.3, 5.5, 0.1, 2.0],
    unit: ["katori", 120],
  },
  {
    name: "Broccoli, cooked",
    aliases: ["broccoli"],
    n: [35, 2.4, 7.2, 0.4, 3.3],
    unit: ["katori", 120],
  },
  {
    name: "Beans, french, cooked",
    aliases: ["french beans", "green beans"],
    n: [35, 1.9, 7.9, 0.2, 3.4],
    unit: ["katori", 120],
  },
  {
    name: "Bottle gourd / lauki, cooked",
    aliases: ["lauki", "bottle gourd", "dudhi"],
    n: [20, 0.6, 5.0, 0.1, 1.2],
    unit: ["katori", 150],
  },
  {
    name: "Pumpkin, cooked",
    aliases: ["pumpkin", "kaddu"],
    n: [26, 1.0, 6.5, 0.1, 1.1],
    unit: ["katori", 150],
  },
  {
    name: "Sweet potato, boiled",
    aliases: ["sweet potato", "shakarkandi"],
    n: [90, 2.0, 20.7, 0.2, 3.3],
    unit: ["medium", 130],
  },
  {
    name: "Mushroom, cooked",
    aliases: ["mushroom"],
    n: [28, 2.2, 5.3, 0.5, 2.2],
    unit: ["katori", 100],
  },
  {
    name: "Corn, sweet, boiled",
    aliases: ["corn", "sweet corn", "bhutta"],
    n: [96, 3.4, 21.0, 1.5, 2.4],
    unit: ["cob", 90],
  },
  {
    name: "Beetroot, boiled",
    aliases: ["beetroot", "chukandar"],
    n: [44, 1.7, 10.0, 0.2, 2.0],
    unit: ["katori", 120],
  },
  {
    name: "Salad, green, undressed",
    aliases: ["salad", "green salad"],
    n: [20, 1.2, 3.5, 0.2, 1.6],
    unit: ["bowl", 100],
  },

  // --- More fruit ----------------------------------------------------------
  {
    name: "Grapes",
    aliases: ["grapes", "angoor"],
    n: [69, 0.7, 18.1, 0.2, 0.9],
    unit: ["bowl", 100],
  },
  {
    name: "Pomegranate",
    aliases: ["pomegranate", "anar"],
    n: [83, 1.7, 18.7, 1.2, 4.0],
    unit: ["bowl", 100],
  },
  {
    name: "Pineapple",
    aliases: ["pineapple", "ananas"],
    n: [50, 0.5, 13.1, 0.1, 1.4],
    unit: ["bowl", 150],
  },
  {
    name: "Chikoo / sapota",
    aliases: ["chikoo", "sapota", "sapodilla"],
    n: [83, 0.7, 20.0, 1.1, 5.3],
    unit: ["fruit", 90],
  },
  {
    name: "Custard apple",
    aliases: ["custard apple", "sitaphal"],
    n: [94, 2.1, 23.6, 0.6, 4.4],
    unit: ["fruit", 150],
  },
  {
    name: "Pear",
    aliases: ["pear", "nashpati"],
    n: [57, 0.4, 15.2, 0.1, 3.1],
    unit: ["pear", 170],
  },
  {
    name: "Strawberries",
    aliases: ["strawberry", "strawberries"],
    n: [32, 0.7, 7.7, 0.3, 2.0],
    unit: ["bowl", 100],
  },
  { name: "Dates", aliases: ["dates", "khajur"], n: [282, 2.5, 75.0, 0.4, 8.0], unit: ["date", 8] },
  {
    name: "Raisins",
    aliases: ["raisins", "kishmish"],
    n: [299, 3.1, 79.2, 0.5, 3.7],
    unit: ["handful", 30],
  },
  {
    name: "Coconut, fresh",
    aliases: ["coconut", "nariyal"],
    n: [354, 3.3, 15.2, 33.5, 9.0],
    unit: ["portion", 50],
  },
  { name: "Avocado", aliases: ["avocado"], n: [160, 2.0, 8.5, 14.7, 6.7], unit: ["half", 100] },

  // --- More nuts, seeds and fats -------------------------------------------
  {
    name: "Pistachios",
    aliases: ["pista", "pistachio"],
    n: [560, 20.0, 28.0, 45.0, 10.0],
    unit: ["handful", 30],
  },
  { name: "Chia seeds", aliases: ["chia"], n: [486, 16.5, 42.0, 30.7, 34.4], unit: ["tbsp", 12] },
  {
    name: "Flax seeds",
    aliases: ["flax", "alsi", "linseed"],
    n: [534, 18.3, 28.9, 42.2, 27.3],
    unit: ["tbsp", 10],
  },
  {
    name: "Sunflower seeds",
    aliases: ["sunflower seeds"],
    n: [584, 20.8, 20.0, 51.5, 8.6],
    unit: ["handful", 30],
  },
  {
    name: "Sesame seeds",
    aliases: ["til", "sesame"],
    n: [573, 17.7, 23.4, 49.7, 11.8],
    unit: ["tbsp", 9],
  },
  { name: "Olive oil", aliases: ["olive oil"], n: [884, 0, 0, 100, 0], unit: ["tbsp", 14] },
  { name: "Coconut oil", aliases: ["coconut oil"], n: [884, 0, 0, 100, 0], unit: ["tbsp", 14] },
  {
    name: "Mustard oil",
    aliases: ["mustard oil", "sarson oil"],
    n: [884, 0, 0, 100, 0],
    unit: ["tbsp", 14],
  },

  // --- More snacks, street food and sweets ----------------------------------
  {
    name: "Vada pav",
    aliases: ["vada pav"],
    n: [290, 6.5, 40.0, 11.5, 3.0],
    unit: ["piece", 130],
    confidence: "estimated",
  },
  {
    name: "Pani puri",
    aliases: ["pani puri", "golgappa", "puchka"],
    n: [330, 5.5, 45.0, 14.0, 3.0],
    unit: ["six", 90],
    confidence: "estimated",
  },
  {
    name: "Bhel puri",
    aliases: ["bhel", "bhel puri"],
    n: [250, 6.0, 38.0, 8.0, 4.0],
    unit: ["plate", 120],
    confidence: "estimated",
  },
  {
    name: "Dhokla",
    aliases: ["dhokla"],
    n: [160, 6.0, 24.0, 4.5, 2.5],
    unit: ["piece", 40],
    confidence: "estimated",
  },
  {
    name: "Momos, vegetable",
    aliases: ["momos", "veg momos", "dumplings"],
    n: [190, 5.5, 30.0, 5.0, 2.0],
    unit: ["six", 180],
    confidence: "estimated",
  },
  {
    name: "Momos, chicken",
    aliases: ["chicken momos"],
    n: [210, 10.0, 27.0, 6.5, 1.6],
    unit: ["six", 180],
    confidence: "estimated",
  },
  {
    name: "Chakli / murukku",
    aliases: ["chakli", "murukku"],
    n: [520, 8.0, 55.0, 29.0, 3.0],
    unit: ["piece", 15],
    confidence: "estimated",
  },
  {
    name: "Namkeen mixture",
    aliases: ["namkeen", "mixture", "sev"],
    n: [520, 12.0, 48.0, 31.0, 5.0],
    unit: ["handful", 30],
    confidence: "estimated",
  },
  {
    name: "Potato chips",
    aliases: ["chips", "crisps", "potato chips"],
    n: [536, 6.6, 53.0, 34.6, 4.4],
    unit: ["packet", 30],
  },
  {
    name: "French fries",
    aliases: ["fries", "french fries"],
    n: [312, 3.4, 41.0, 15.0, 3.8],
    unit: ["portion", 120],
    confidence: "estimated",
  },
  {
    name: "Biscuit, glucose",
    aliases: ["biscuit", "parle g", "glucose biscuit"],
    n: [450, 7.0, 76.0, 13.5, 1.5],
    unit: ["biscuit", 6],
  },
  {
    name: "Biscuit, cream",
    aliases: ["cream biscuit", "bourbon"],
    n: [480, 5.5, 70.0, 20.0, 1.5],
    unit: ["biscuit", 12],
  },
  {
    name: "Rasgulla",
    aliases: ["rasgulla", "rosogolla"],
    n: [186, 4.0, 38.0, 2.0, 0],
    unit: ["piece", 50],
    confidence: "estimated",
  },
  {
    name: "Ladoo, besan",
    aliases: ["ladoo", "laddu", "besan ladoo"],
    n: [465, 8.5, 55.0, 24.0, 3.5],
    unit: ["ladoo", 40],
    confidence: "estimated",
  },
  {
    name: "Barfi",
    aliases: ["barfi", "burfi"],
    n: [400, 8.0, 48.0, 19.0, 1.0],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Gajar halwa",
    aliases: ["halwa", "gajar halwa", "carrot halwa"],
    n: [240, 3.5, 30.0, 12.0, 2.0],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  {
    name: "Kheer / payasam",
    aliases: ["kheer", "payasam", "rice pudding"],
    n: [145, 3.8, 22.0, 4.8, 0.3],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Chocolate, milk",
    aliases: ["chocolate", "milk chocolate", "dairy milk"],
    n: [535, 7.6, 59.0, 30.0, 3.4],
    unit: ["bar", 40],
  },
  {
    name: "Chocolate, dark 70%",
    aliases: ["dark chocolate"],
    n: [598, 7.8, 45.9, 42.6, 10.9],
    unit: ["square", 10],
  },
  {
    name: "Cake, sponge",
    aliases: ["cake", "sponge cake", "pastry"],
    n: [310, 5.5, 50.0, 10.0, 0.9],
    unit: ["slice", 80],
    confidence: "estimated",
  },
  {
    name: "Pizza, cheese",
    aliases: ["pizza"],
    n: [266, 11.0, 33.0, 10.0, 2.3],
    unit: ["slice", 100],
    confidence: "estimated",
  },
  {
    name: "Burger, vegetable",
    aliases: ["burger", "veg burger"],
    n: [250, 8.0, 33.0, 9.5, 2.5],
    unit: ["burger", 180],
    confidence: "estimated",
  },
  {
    name: "Burger, chicken",
    aliases: ["chicken burger"],
    n: [270, 14.0, 28.0, 11.5, 1.8],
    unit: ["burger", 190],
    confidence: "estimated",
  },
  {
    name: "Sandwich, vegetable",
    aliases: ["sandwich", "veg sandwich"],
    n: [220, 7.0, 30.0, 8.0, 2.8],
    unit: ["sandwich", 150],
    confidence: "estimated",
  },
  { name: "Sugar", aliases: ["sugar", "cheeni"], n: [400, 0, 100, 0, 0], unit: ["tsp", 5] },
  { name: "Honey", aliases: ["honey", "shahad"], n: [304, 0.3, 82.4, 0, 0.2], unit: ["tsp", 7] },
  {
    name: "Jaggery / gur",
    aliases: ["jaggery", "gur"],
    n: [383, 0.4, 98.0, 0.1, 0],
    unit: ["piece", 10],
  },

  // --- More drinks -----------------------------------------------------------
  { name: "Water", aliases: ["water", "pani"], n: [0, 0, 0, 0, 0], unit: ["glass", 250] },
  {
    name: "Orange juice",
    aliases: ["orange juice", "juice"],
    n: [45, 0.7, 10.4, 0.2, 0.2],
    unit: ["glass", 200],
  },
  {
    name: "Coconut water",
    aliases: ["coconut water", "nariyal pani"],
    n: [19, 0.7, 3.7, 0.2, 1.1],
    unit: ["glass", 250],
  },
  {
    name: "Sugarcane juice",
    aliases: ["sugarcane juice", "ganne ka ras"],
    n: [74, 0.2, 18.0, 0.1, 0.1],
    unit: ["glass", 250],
    confidence: "estimated",
  },
  {
    name: "Milkshake, mango",
    aliases: ["milkshake", "mango shake"],
    n: [110, 2.8, 19.0, 2.5, 0.4],
    unit: ["glass", 250],
    confidence: "estimated",
  },
  {
    name: "Cola, diet / zero",
    aliases: ["diet coke", "coke zero", "diet cola"],
    n: [1, 0, 0.1, 0, 0],
    unit: ["can", 330],
  },
  // --- The aromatics and vegetables a recipe is actually built from -------
  //
  // These are here because the recipe estimator kept failing on them. A
  // sambar is drumstick, curry leaves, tamarind and ginger; none of those
  // were in the table, so each was either left unpriced or answered from a
  // supermarket shelf — "drumstick" came back as a chicken leg, and once as
  // a British sweet.
  {
    name: "Drumstick / moringa pods, cooked",
    aliases: ["drumstick", "moringa", "murungakkai", "sahjan"],
    n: [37, 2.1, 8.5, 0.2, 3.2],
    unit: ["pod", 40],
    confidence: "measured",
  },
  {
    name: "Curry leaves",
    aliases: ["curry leaves", "kadi patta", "karuveppilai"],
    n: [108, 6.1, 18.7, 1.0, 6.4],
    unit: ["sprig", 3],
  },
  {
    name: "Coriander leaves",
    aliases: ["coriander", "cilantro", "dhania", "kothamalli"],
    n: [23, 2.1, 3.7, 0.5, 2.8],
    unit: ["handful", 10],
  },
  {
    name: "Mint leaves",
    aliases: ["mint", "pudina"],
    n: [48, 3.8, 8.4, 0.7, 6.8],
    unit: ["handful", 10],
  },
  {
    name: "Ginger",
    aliases: ["ginger", "adrak", "inji"],
    n: [80, 1.8, 17.8, 0.8, 2.0],
    unit: ["inch", 6],
  },
  {
    name: "Garlic",
    aliases: ["garlic", "lehsun", "poondu"],
    n: [149, 6.4, 33.1, 0.5, 2.1],
    unit: ["clove", 3],
  },
  {
    name: "Green chilli",
    aliases: ["green chilli", "chilli", "mirchi", "molagai"],
    n: [40, 1.9, 8.8, 0.4, 1.5],
    unit: ["chilli", 5],
  },
  {
    name: "Capsicum / bell pepper",
    aliases: ["capsicum", "bell pepper", "shimla mirch"],
    n: [26, 1.0, 6.0, 0.3, 2.1],
    unit: ["katori", 100],
  },
  {
    name: "Brinjal / aubergine, cooked",
    aliases: ["brinjal", "aubergine", "eggplant", "baingan", "kathirikai"],
    n: [35, 0.8, 8.7, 0.2, 2.5],
    unit: ["katori", 120],
  },
  {
    name: "Raw banana / plantain, cooked",
    aliases: ["raw banana", "plantain", "vazhakkai"],
    n: [116, 0.8, 31.0, 0.2, 2.3],
    unit: ["katori", 120],
  },
  {
    name: "Yam / suran, cooked",
    aliases: ["yam", "suran", "elephant foot"],
    n: [118, 1.5, 27.9, 0.2, 4.1],
    unit: ["katori", 120],
  },
  {
    name: "Cluster beans / gawar, cooked",
    aliases: ["cluster beans", "gawar", "kothavarangai"],
    n: [46, 3.2, 10.8, 0.4, 3.4],
    unit: ["katori", 120],
  },
  {
    name: "Ash gourd, cooked",
    aliases: ["ash gourd", "petha", "poosanikai"],
    n: [13, 0.4, 3.0, 0.2, 1.4],
    unit: ["katori", 150],
  },
  {
    name: "Ridge gourd, cooked",
    aliases: ["ridge gourd", "turai", "peerkangai"],
    n: [20, 0.5, 4.4, 0.1, 1.8],
    unit: ["katori", 150],
  },
  {
    name: "Spring onion",
    aliases: ["spring onion", "scallion"],
    n: [32, 1.8, 7.3, 0.2, 2.6],
    unit: ["handful", 30],
  },
  {
    name: "Coconut milk",
    aliases: ["coconut milk", "thengai paal"],
    n: [197, 2.0, 4.8, 20.0, 2.2],
    unit: ["katori", 100],
    confidence: "estimated",
  },
  {
    name: "Tamarind pulp",
    aliases: ["tamarind", "imli", "puli"],
    n: [239, 2.8, 62.5, 0.6, 5.1],
    unit: ["tbsp", 15],
  },
  {
    name: "Mixed vegetables, cooked",
    aliases: ["mixed vegetables", "mixed veg"],
    n: [45, 2.3, 9.0, 0.3, 3.2],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  // --- Regional cooking, because "Indian food" is not one cuisine ---------
  //
  // Coverage was measured against a list of what people actually eat across
  // the country and came back at 69 per cent — with South Indian the weakest
  // at fifteen of thirty-one, in an app built for India. Rasam was missing
  // outright, which is a daily staple in half the country.
  {
    name: "Pongal / ven pongal",
    aliases: ["pongal", "ven pongal", "khara pongal"],
    n: [165, 4.5, 24.0, 5.8, 1.5],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Puttu",
    aliases: ["puttu"],
    n: [145, 2.8, 30.0, 1.8, 1.6],
    unit: ["piece", 100],
    confidence: "estimated",
  },
  {
    name: "Idiyappam / string hoppers",
    aliases: ["idiyappam", "string hoppers", "sevai"],
    n: [140, 2.6, 31.0, 0.4, 1.2],
    unit: ["piece", 50],
    confidence: "estimated",
  },
  {
    name: "Rasam",
    aliases: ["rasam", "saaru", "chaaru"],
    n: [32, 1.5, 5.5, 0.7, 1.0],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Avial",
    aliases: ["avial", "aviyal"],
    n: [120, 2.5, 8.0, 8.8, 2.8],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Kootu",
    aliases: ["kootu"],
    n: [95, 4.5, 12.0, 3.2, 3.5],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Poriyal",
    aliases: ["poriyal", "dry vegetable"],
    n: [85, 2.2, 9.0, 4.5, 3.0],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  {
    name: "Thoran",
    aliases: ["thoran"],
    n: [90, 2.4, 9.5, 4.8, 3.2],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  {
    name: "Olan",
    aliases: ["olan"],
    n: [78, 1.2, 5.0, 6.2, 1.5],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Erissery",
    aliases: ["erissery"],
    n: [130, 3.5, 15.0, 6.5, 3.5],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Bisibelebath",
    aliases: ["bisibelebath", "bisi bele bath"],
    n: [150, 4.5, 22.0, 5.0, 2.5],
    unit: ["plate", 250],
    confidence: "estimated",
  },
  {
    name: "Kesari / rava sheera",
    aliases: ["kesari", "sheera", "rava kesari"],
    n: [320, 4.0, 48.0, 12.0, 1.0],
    unit: ["katori", 100],
    confidence: "estimated",
  },
  {
    name: "Adai",
    aliases: ["adai"],
    n: [190, 8.5, 26.0, 5.5, 4.5],
    unit: ["piece", 80],
    confidence: "estimated",
  },
  {
    name: "Paniyaram",
    aliases: ["paniyaram", "appe", "gunta ponganalu"],
    n: [175, 4.2, 27.0, 5.5, 1.8],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Molagapodi / gunpowder",
    aliases: ["molagapodi", "gunpowder", "idli podi"],
    n: [420, 18.0, 40.0, 21.0, 12.0],
    unit: ["tsp", 5],
    confidence: "estimated",
  },
  {
    name: "Raita",
    aliases: ["raita"],
    n: [60, 2.8, 5.0, 3.2, 0.4],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  {
    name: "Kulcha",
    aliases: ["kulcha"],
    n: [290, 8.0, 50.0, 6.0, 2.2],
    unit: ["piece", 80],
    confidence: "estimated",
  },
  {
    name: "Luchi",
    aliases: ["luchi"],
    n: [400, 6.5, 45.0, 21.0, 1.8],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Shukto",
    aliases: ["shukto"],
    n: [75, 2.0, 8.5, 3.8, 2.5],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Macher jhol / Bengali fish curry",
    aliases: ["macher jhol", "fish jhol"],
    n: [125, 12.5, 4.0, 6.5, 0.8],
    unit: ["katori", 200],
    confidence: "estimated",
  },
  {
    name: "Aloo posto",
    aliases: ["posto", "aloo posto"],
    n: [180, 5.5, 9.0, 14.0, 3.0],
    unit: ["katori", 120],
    confidence: "estimated",
  },
  {
    name: "Mishti doi",
    aliases: ["mishti doi", "sweet curd"],
    n: [155, 4.0, 26.0, 4.0, 0],
    unit: ["katori", 100],
    confidence: "estimated",
  },
  {
    name: "Sandesh",
    aliases: ["sandesh"],
    n: [320, 12.0, 38.0, 13.0, 0],
    unit: ["piece", 30],
    confidence: "estimated",
  },
  {
    name: "Khandvi",
    aliases: ["khandvi"],
    n: [180, 6.5, 18.0, 9.0, 2.0],
    unit: ["piece", 25],
    confidence: "estimated",
  },
  {
    name: "Undhiyu",
    aliases: ["undhiyu"],
    n: [165, 4.5, 16.0, 9.5, 5.0],
    unit: ["katori", 150],
    confidence: "estimated",
  },
  {
    name: "Fafda",
    aliases: ["fafda"],
    n: [480, 11.0, 45.0, 28.0, 4.0],
    unit: ["handful", 30],
    confidence: "estimated",
  },
  {
    name: "Handvo",
    aliases: ["handvo"],
    n: [210, 6.5, 28.0, 8.0, 3.5],
    unit: ["piece", 80],
    confidence: "estimated",
  },
  {
    name: "Shrikhand",
    aliases: ["shrikhand"],
    n: [245, 6.0, 35.0, 8.5, 0.3],
    unit: ["katori", 100],
    confidence: "estimated",
  },
  {
    name: "Puran poli",
    aliases: ["puran poli", "obbattu", "holige"],
    n: [300, 7.0, 52.0, 7.0, 3.5],
    unit: ["piece", 70],
    confidence: "estimated",
  },
  {
    name: "Modak",
    aliases: ["modak"],
    n: [280, 4.5, 42.0, 10.5, 2.5],
    unit: ["piece", 35],
    confidence: "estimated",
  },
  {
    name: "Kachori",
    aliases: ["kachori"],
    n: [420, 8.5, 45.0, 23.0, 3.5],
    unit: ["piece", 50],
    confidence: "estimated",
  },
  {
    name: "Papdi chaat",
    aliases: ["chaat", "papdi chaat"],
    n: [240, 6.0, 32.0, 10.0, 3.5],
    unit: ["plate", 150],
    confidence: "estimated",
  },
  {
    name: "Frankie / kathi roll",
    aliases: ["frankie", "kathi roll", "egg roll"],
    n: [250, 9.0, 30.0, 10.5, 2.5],
    unit: ["roll", 180],
    confidence: "estimated",
  },
  {
    name: "Dabeli",
    aliases: ["dabeli"],
    n: [260, 6.0, 38.0, 9.5, 3.0],
    unit: ["piece", 120],
    confidence: "estimated",
  },
  {
    name: "Bonda",
    aliases: ["bonda"],
    n: [290, 5.0, 33.0, 15.5, 2.5],
    unit: ["piece", 45],
    confidence: "estimated",
  },
  {
    name: "Semolina / suji, dry",
    aliases: ["suji", "sooji", "rava", "semolina"],
    n: [360, 12.7, 72.8, 1.1, 3.9],
    unit: ["katori", 100],
    confidence: "measured",
  },

];

/** Sodium and sugar are not carried in the table; they are set to 0 rather
 *  than guessed, and the UI shows them as unknown rather than as zero. */
function nutrients(r) {
  const [kcal, protein, carbs, fat, fibre] = r.n;
  return { kcal, protein, carbs, fat, fibre, sugar: 0, satFat: 0, sodium: 0 };
}

export const FOODS = ROWS.map((r, i) => ({
  id: `in:${i}`,
  source: "custom",
  name: r.name,
  brand: null,
  per100g: nutrients(r),
  servingG: r.unit?.[1] ?? null,
  servingLabel: r.unit ? `1 ${r.unit[0]}` : null,
  confidence: r.confidence ?? "estimated",
  /* The names people type, carried on the food itself. The ranker only ever
     compared against the display name, so "Dosa, plain" scored as a prefix
     match for "dosa" while a crowd-sourced row literally called "Dosa" took
     the exact-match bonus and won — even though "dosa" is a listed alias of
     the checked entry. */
  aliases: r.aliases ?? [],
}));

const INDEX = ROWS.map((r, i) => ({
  food: FOODS[i],
  terms: [r.name.toLowerCase(), ...(r.aliases ?? [])],
}));

/** Substring match over names and aliases, best match first. */
/** "onions" to "onion", "tomatoes" to "tomato". Crude, and enough. */
function singular(w) {
  if (w.length < 4) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes") || w.endsWith("hes") || w.endsWith("ses")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function search(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  /* Words worth matching on their own. Two letters carry no signal, and
     a query is not always a phrase.
     Singularised, because people type what they cooked with — "onions",
     "tomatoes", "eggs" — and the table names the thing itself. Without this
     every plural found nothing at all. */
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2).map(singular);

  const hits = [
];
  for (const { food, terms } of INDEX) {
    let best = 0;
    for (const t of terms) {
      if (t === q) best = Math.max(best, 100);
      else if (t.startsWith(q)) best = Math.max(best, 80);
      else if (t.includes(q)) best = Math.max(best, 55);
    }

    /* Phrase matching alone answered "basmati rice cooked" with nothing at
       all, while "Rice, basmati, cooked" sat in the table — every word
       present, in a different order. That made the whole curated table
       invisible to any multi-word search, in the app and in the recipe
       estimator both. */
    if (best === 0 && words.length >= 1) {
      const blob = terms.map((t) => t.split(" ").map(singular).join(" ")).join(" ");
      const found = words.filter((w) => blob.includes(w)).length;
      if (found === words.length) best = 50;
      /* One word short still counts. "onion sauteed" and "almonds raw" carry
         one word naming the food and one describing what was done to it, and
         demanding both matched left onions answered by breaded onion rings
         in aioli — a real Open Food Facts row, and 300 kcal adrift. Being
         generous here is safe: the caller scores these against the shelf and
         a curated row wins outright. */
      else if (found >= 1 && found >= words.length - 1) best = 30;
    }

    if (best > 0) hits.push({ food, score: best });
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => h.food);
}

export const byId = (id) => FOODS.find((f) => f.id === id) ?? null;
