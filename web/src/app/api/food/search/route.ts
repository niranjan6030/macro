import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { dbConfigured } from "@/lib/db";
import { searchAll } from "@/lib/nutrition/search";

/**
 * Search every nutrition source at once.
 *
 * Normally signed-in only, because it proxies a metered USDA key. With no
 * backend configured there is nobody to sign in as and the app is running
 * standalone in the browser — searching for food is the one thing it still
 * needs a server for, since Open Food Facts and USDA both refuse browser
 * requests on CORS. So in that case it answers anyone.
 */
export async function GET(req: Request) {
  if (dbConfigured()) {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
  }

  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ query: q, foods: await searchAll(q, 20) });
}
