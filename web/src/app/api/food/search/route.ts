import { withUser, ok } from "@/lib/api";
import { searchAll } from "@/lib/nutrition/search";

/** Search every source at once. Signed in only — this proxies paid quota. */
export const GET = withUser(async (_uid, req) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return ok({ query: q, foods: await searchAll(q, 20) });
});
