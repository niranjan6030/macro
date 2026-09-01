import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { dbConfigured } from "@/lib/db";
import { estimate } from "@/lib/ai/estimate";

/**
 * Estimate a home-cooked dish from its name.
 *
 * Open when running standalone, like food search, and for the same reason:
 * there is nobody to sign in as, and this is a server-side proxy over public
 * data plus the deployment's own AI key.
 */
export async function POST(req) {
  if (dbConfigured()) {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const dish = typeof body.dish === "string" ? body.dish.trim().slice(0, 120) : "";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 600) : undefined;

  if (dish.length < 2) {
    return NextResponse.json({ error: "Name the dish first." }, { status: 400 });
  }

  return NextResponse.json(await estimate(dish, description));
}
