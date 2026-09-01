import { NextResponse } from "next/server";
import { dbConfigured, purgeExpiredPhotos } from "@/lib/db";

/**
 * The retention sweep.
 *
 * Photos are the largest thing this app stores and the least often looked
 * at — a year of daily front shots is more bytes than everything else put
 * together, and almost nobody opens the middle of that range twice. So they
 * expire, and what survives is the row: the date, the pose, the weight. The
 * progress chart is made of those, costs nothing to keep, and still works
 * after the images are gone.
 *
 * Run by Vercel Cron, which sends the deployment's CRON_SECRET as a bearer
 * token. Without that header this does nothing — an endpoint that deletes
 * things on request from anyone is not a retention policy.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not for you." }, { status: 401 });
  }
  if (!dbConfigured()) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }

  const purged = await purgeExpiredPhotos();
  return NextResponse.json({ purged });
}
