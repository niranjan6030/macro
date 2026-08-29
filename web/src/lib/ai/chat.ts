import "server-only";
import { searchAll } from "@/lib/nutrition/search";
import { forGrams } from "@/lib/nutrition/types";
import { aiConfigured, type ToolSpec } from "./provider";
import { runRound } from "./run";

/**
 * The coach you can talk to.
 *
 * Same division of labour as everywhere else in this app, and for the same
 * reason: the model is given facts and it is not allowed to invent them. Its
 * context is assembled here from the person's actual diary — today's intake,
 * their targets, the weight trend, what they trained — and the system prompt
 * forbids stating any figure that is not in it.
 *
 * The one thing it can go and fetch is nutrition data, through a tool that
 * hits the same databases the rest of the app uses. So "how many calories in
 * two rotis and a katori of dal" is answered by looking up roti and dal and
 * multiplying, not by recalling roughly what a roti costs. That question is
 * exactly where a general assistant quietly makes something up.
 */

export const chatConfigured = aiConfigured;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Everything true about this person, computed before the model is called. */
export interface ChatContext {
  name?: string | null;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  goal: string;
  targetWeightKg: number | null;
  targets: { kcal: number; protein: number; carbs: number; fat: number; fibre: number; tdee: number; bmr: number };
  today: { kcal: number; protein: number; carbs: number; fat: number; fibre: number };
  remaining: { kcal: number; protein: number; carbs: number; fat: number };
  eatenToday: { name: string; grams: number; kcal: number }[];
  weekAvgKcal: number | null;
  trendChangeKg: number | null;
  daysToGoal: number | null;
  goalVerdict: string;
  recentWorkouts: { date: string; name: string; sets: number }[];
  restDay: boolean;
  cheatDay: boolean;
}

const LOOKUP: ToolSpec = {
  name: "look_up_food",
  description:
    "Look up the real nutrition for a food, from Open Food Facts, USDA FoodData "
    + "Central, or the built-in table of Indian staples. Use this for ANY question "
    + "involving what a food contains. Never state calories or macros from memory.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Plain generic name and cooking method: 'roti', 'toor dal cooked', 'chicken breast grilled'.",
      },
      grams: {
        type: "number",
        description: "Weight to scale to. Omit for per-100 g.",
      },
    },
    required: ["query"],
  },
};

function systemPrompt(c: ChatContext): string {
  return `You are Macro AI, the coach inside Macro, a food and training tracker.
You are talking to ${c.name ?? "the person whose data this is"}.

Everything below was computed from their logged data. It is the only set of
facts you have.

BODY
  ${c.sex}, ${c.age}, ${c.heightCm} cm, ${c.weightKg} kg, ${c.bodyFatPct}% body fat
  Goal: ${c.goal}${c.targetWeightKg ? ` towards ${c.targetWeightKg} kg` : ""}
  BMR ${c.targets.bmr} kcal, maintenance ${c.targets.tdee} kcal

DAILY TARGETS
  ${c.targets.kcal} kcal · ${c.targets.protein} g protein · ${c.targets.carbs} g carbs · ${c.targets.fat} g fat · ${c.targets.fibre} g fibre

TODAY SO FAR
  ${c.today.kcal} kcal · ${c.today.protein} g protein · ${c.today.carbs} g carbs · ${c.today.fat} g fat · ${c.today.fibre} g fibre
  Remaining: ${c.remaining.kcal} kcal, ${c.remaining.protein} g protein, ${c.remaining.carbs} g carbs, ${c.remaining.fat} g fat
  Eaten: ${c.eatenToday.length ? c.eatenToday.map((e) => `${e.name} ${e.grams} g (${Math.round(e.kcal)} kcal)`).join("; ") : "nothing logged yet"}
  ${c.restDay ? "Marked as a rest day." : ""}${c.cheatDay ? " Marked as a cheat day." : ""}

TREND
  ${c.weekAvgKcal != null ? `Averaging ${c.weekAvgKcal} kcal a day.` : "Not enough logged days to average."}
  ${c.trendChangeKg != null ? `Trend weight has moved ${c.trendChangeKg > 0 ? "+" : ""}${c.trendChangeKg} kg.` : "Not enough weigh-ins for a trend."}
  ${c.daysToGoal != null ? `About ${c.daysToGoal} days to the goal at this rate.` : ""}
  ${c.goalVerdict}

TRAINING
  ${c.recentWorkouts.length ? c.recentWorkouts.map((w) => `${w.date} ${w.name} (${w.sets} sets)`).join("; ") : "No sessions logged recently."}

RULES — these are not style preferences, they are the point of the product:
- Never state a calorie or macronutrient figure from memory. If you need to
  know what a food contains, call look_up_food. Every time.
- Look up every food in the question at once, in a single turn, rather than
  one per turn.
- Take the first result you are given and use it. Do not search again for a
  closer name — "toor dal cooked" is a perfectly good answer for "dal", and a
  second search costs the person several seconds for a difference of a few
  calories. Only search again if the result is plainly a different food.
- Never invent a number about this person. If it is not above, say you do not
  have it and say what they would need to log for you to know.
- Arithmetic on the numbers above is fine and encouraged — that is your job.
- If they ask what to eat, work from what is actually remaining today and
  suggest real food, with weights.
- No medical advice. If something looks clinical — very low intake, rapid
  loss, injury — tell them to see a doctor, plainly and once.

HOW TO WRITE
- Plain British English. Short. No headings, no bullet lists unless they asked
  for a list. No exclamation marks. No "Great question".
- Two or three sentences is usually right. They are on a phone.
- Be direct. If they are off track, say so and say what to change.
- Never moralise about food. A cheat day is a plan, not a failure.`;
}

export async function reply(
  history: ChatMessage[],
  context: ChatContext,
): Promise<{ text: string; lookups: string[] }> {
  if (!aiConfigured()) {
    return {
      text: "Macro AI is not switched on for this deployment. It needs an "
        + "ANTHROPIC_API_KEY, or a GEMINI_API_KEY for Google's free tier — "
        + "see README, section 3.",
      lookups: [],
    };
  }

  const system = systemPrompt(context);
  const lookups: string[] = [];

  let scratch: unknown[] | undefined;
  let toolResults: { id: string; name: string; result: string }[] | undefined;

  /* Six rounds. Four was not enough in practice: a question naming two foods
     could spend a round on each, then another deciding it wanted a better
     match, and run out before answering. The prompt now asks for one batched
     turn, so this ceiling should rarely be approached — it is a stop, not a
     budget. */
  for (let round = 0; round < 6; round++) {
    const res = await runRound({
      system, history, tools: [LOOKUP], maxTokens: 900, scratch, toolResults,
    });
    scratch = res.scratch;

    if (!res.calls.length) {
      return {
        text: res.text || "I could not work that one out. Try asking it another way.",
        lookups,
      };
    }

    toolResults = await Promise.all(res.calls.map(async (call) => {
      const { query, grams } = call.args as { query?: string; grams?: number };
      const q = typeof query === "string" ? query : "";
      lookups.push(q);
      return { id: call.id, name: call.name, result: await lookUp(q, grams) };
    }));
  }

  return {
    text: "That needed more looking up than I can do in one go. Try asking "
      + "about one food at a time.",
    lookups,
  };
}

/** The tool body: a real database lookup, formatted for the model to read. */
async function lookUp(query: string, grams?: number): Promise<string> {
  const hits = await searchAll(query, 3).catch(() => []);
  if (!hits.length) {
    return `No database entry for "${query}". Tell them it is not in the "
      + "database and to add it by hand from the packet.`;
  }

  const f = hits[0];
  const n = grams && grams > 0 ? forGrams(f.per100g, grams) : f.per100g;
  const basis = grams && grams > 0 ? `${grams} g` : "100 g";
  const source =
    f.confidence === "measured" ? "laboratory measured"
    : f.confidence === "label" ? "from the manufacturer's panel"
    : "an estimate";

  /* Deliberately no list of alternatives.
   *
   * An earlier version ended with "Other matches: ...", and the model read
   * that as an invitation — it kept searching for a closer name instead of
   * answering, burning a round each time and several seconds of the person's
   * life for a difference of a few calories. The best match is the answer. */
  return [
    `${f.name}${f.brand ? ` (${f.brand})` : ""} — per ${basis}:`,
    `${Math.round(n.kcal)} kcal, ${n.protein} g protein, ${n.carbs} g carbs, `
      + `${n.fat} g fat, ${n.fibre} g fibre.`,
    `Source: ${f.source}, ${source}.`,
    f.servingG ? `One ${f.servingLabel ?? "serving"} is about ${f.servingG} g.` : "",
    "This is the best match. Use it.",
  ].filter(Boolean).join(" ");
}
