import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { dbConfigured } from "@/lib/db";
import { off } from "@/lib/nutrition/search";

/**
 * Look up a packet by its barcode.
 *
 * This is the most accurate entry there is — the manufacturer's own declared
 * panel for that exact product — so the scanner is the fastest correct way
 * to log anything that came in a wrapper.
 */
export async function GET(_req, ctx) {
  // Public when running standalone; see the note in ../search/route.js.
  if (dbConfigured()) {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
  }

  const { code } = await ctx.params;
  const food = await off.byBarcode(code);

  if (!food) {
    return NextResponse.json(
      {
        error:
          "That barcode is not in the database yet. Enter it by hand and it will be saved for next time.",
      },
      { status: 404 },
    );
  }
  return NextResponse.json({ food });
}
