import "server-only";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/firebase/admin";
import { NotConfigured, dbConfigured } from "@/lib/db";

/**
 * The two things every route handler needs: a verified uid, and a
 * consistent way to fail.
 */

type Handler = (uid: string, req: Request) => Promise<Response>;

/**
 * Wrap a handler so it only runs for a signed-in person.
 *
 * The uid comes from the verified session cookie and nowhere else. Passing
 * it in as the first argument rather than letting handlers reach for it
 * makes the scoping impossible to forget.
 */
export function withUser(handler: Handler) {
  return async (req: Request): Promise<Response> => {
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
      console.error("[api]", req.method, new URL(req.url).pathname, e);
      return fail("Something went wrong. Try again.", 500);
    }
  };
}

export const ok = <T>(data: T) => NextResponse.json(data);

export const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/** Read a JSON body without throwing on malformed input. */
export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}

/** A finite number inside a range, or null. Used on every numeric field. */
export function num(v: unknown, lo: number, hi: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

export function str(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length && s.length <= max ? s : null;
}

export const isBool = (v: unknown): boolean => v === true || v === "true";

export function oneOf<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}
