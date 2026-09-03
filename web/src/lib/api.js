import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { NotConfigured, dbConfigured } from "@/lib/db";

/**
 * The two things every route handler needs: a verified uid, and a
 * consistent way to fail.
 */

/**
 * Wrap a handler so it only runs for a signed-in person.
 *
 * The uid comes from the verified session cookie and nowhere else. Passing
 * it in as the first argument rather than letting handlers reach for it
 * makes the scoping impossible to forget.
 */
export function withUser(handler) {
  return async (req) => {
    /* Identity first, infrastructure second.
     *
     * These were the other way round, so an unauthenticated request to a
     * protected route came back "the database is not configured" — telling a
     * stranger about the state of the deployment before establishing they had
     * any business asking. Whether the database is up is not a fact a signed
     * out caller is entitled to. */
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    if (!dbConfigured()) {
      return fail("The database is not configured on this deployment.", 503);
    }

    try {
      return await handler(auth.user.uid, req);
    } catch (e) {
      if (e instanceof NotConfigured) return fail(e.message, 503);

      /* An upstream refusal is not our bug and not a mystery — pass the
         reason through. These messages come from the AI provider and carry
         no credentials; swallowing them turns a five-minute diagnosis into
         an afternoon. */
      if (e?.upstream) {
        console.error("[api] upstream", req.method, new URL(req.url).pathname, e.message);
        return fail(e.message, 502);
      }
      if (e?.overloaded) return fail(e.message, 503);

      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return fail("Something went wrong. Try again.", 500);
    }
  };
}

export const ok = (data) => NextResponse.json(data);

export const fail = (error, status = 400) => NextResponse.json({ error }, { status });

/** Read a JSON body without throwing on malformed input. */
export async function body(req) {
  return await req.json().catch(() => ({}));
}

/** A finite number inside a range, or null. Used on every numeric field. */
export function num(v, lo, hi) {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

export function str(v, max = 200) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length && s.length <= max ? s : null;
}

export const isBool = (v) => v === true || v === "true";

export function oneOf(v, allowed) {
  return typeof v === "string" && allowed.includes(v) ? v : null;
}
