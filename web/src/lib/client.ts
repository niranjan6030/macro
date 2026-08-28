"use client";

/**
 * Talking to our own API.
 *
 * Every route answers `{ error }` on failure, so this turns that into a
 * thrown Error with the server's own wording. Server messages are written
 * for the person reading them; replacing them with "Request failed" here
 * would throw away the useful half.
 */

/**
 * Is there a backend at all?
 *
 * Firebase is what gates everything: without it nobody can sign in, so no
 * request can be authorised and the server has nothing to answer with. When
 * it is missing the app serves itself from the browser instead — see
 * `lib/demo.ts` — and this is the switch.
 */
export const standalone = (): boolean =>
  !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  if (standalone()) {
    const local = await servedLocally<T>(url, init);
    if (local !== MISS) return local as T;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("No connection. Your data is safe — try again when you are back online.", 0);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (json as { error?: string }).error ?? "Something went wrong.",
      res.status,
    );
  }
  return json as T;
}

export const get = <T>(url: string) => request<T>(url);
export const post = <T>(url: string, data: unknown) =>
  request<T>(url, { method: "POST", body: JSON.stringify(data) });
export const put = <T>(url: string, data: unknown) =>
  request<T>(url, { method: "PUT", body: JSON.stringify(data) });
export const del = <T>(url: string) => request<T>(url, { method: "DELETE" });

/** Today, in the browser's timezone. The server never guesses this. */
export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 10);
}

export function prettyDate(iso: string): string {
  const t = today();
  if (iso === t) return "Today";
  const y = new Date(new Date(`${t}T00:00:00`).getTime() - 86_400_000)
    .toISOString().slice(0, 10);
  if (iso === y) return "Yesterday";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short",
  });
}

export const shiftDate = (iso: string, days: number): string =>
  new Date(new Date(`${iso}T00:00:00`).getTime() + days * 86_400_000)
    .toISOString().slice(0, 10);


/* ------------------------------------------------------------------ */
/* Standalone mode                                                     */
/* ------------------------------------------------------------------ */

const MISS = Symbol("not-handled");

/**
 * Serve the routes that only need the browser.
 *
 * Intercepting here rather than at every call site means the pages are
 * written once: they fetch `/api/day` and neither know nor care whether a
 * server answered. Anything not listed falls through to the network, so food
 * search still reaches the real nutrition databases — those are public and
 * need no account.
 */
async function servedLocally<T>(url: string, init?: RequestInit): Promise<T | typeof MISS> {
  const demo = await import("@/lib/demo");
  const method = (init?.method ?? "GET").toUpperCase();
  const parsed = new URL(url, "http://local");
  const path = parsed.pathname;
  const payload = init?.body ? JSON.parse(String(init.body)) : {};

  if (path === "/api/profile") {
    if (method === "GET") return demo.demoProfile() as T;
    if (method === "PUT") return { profile: demo.demoSaveProfile(payload).profile } as T;
  }

  if (path === "/api/day") {
    const date = parsed.searchParams.get("date") ?? payload.date ?? today();
    if (method === "GET") return demo.demoDay(date) as T;
    if (method === "PUT") {
      const { date: _d, ...patch } = payload;
      void _d;
      demo.demoSaveDay(date, patch);
      return { day: demo.demoDay(date).day } as T;
    }
  }

  if (path === "/api/diary") {
    if (method === "POST") {
      if (!payload.per_100g) {
        throw new ApiError(
          "Standalone mode can only log foods you have picked from a search "
          + "result or entered by hand.",
          400,
        );
      }
      return { entry: demo.demoAddEntry({
        date: payload.date ?? today(),
        name: payload.name, brand: payload.brand,
        grams: Number(payload.grams),
        per100g: payload.per_100g,
        source: payload.source ?? "custom",
        sourceId: payload.source_id,
        confidence: payload.confidence,
        meal: payload.meal,
      }) } as T;
    }
    if (method === "DELETE") {
      const id = parsed.searchParams.get("id") ?? "";
      return { deleted: demo.demoDeleteEntry(id) } as T;
    }
  }

  /* Everything else — the coach, photo recognition, progress photos, saved
     workouts — genuinely needs a server, and says so rather than pretending. */
  if (path.startsWith("/api/chat") || path.startsWith("/api/coach")
      || path.startsWith("/api/food/identify") || path.startsWith("/api/progress")
      || path.startsWith("/api/workouts")) {
    throw new ApiError(
      "This part needs the backend connected. See README, sections 1 and 2.",
      503,
    );
  }

  return MISS;
}
