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
 * `lib/demo.js` — and this is the switch.
 */
export const standalone = () => !process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(url, init) {
  if (standalone()) {
    const local = await servedLocally(url, init);
    if (local !== MISS) return local;
  }

  let res;
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
    throw new ApiError(json.error ?? "Something went wrong.", res.status);
  }
  return json;
}

export const get = (url) => request(url);
export const post = (url, data) => request(url, { method: "POST", body: JSON.stringify(data) });
export const put = (url, data) => request(url, { method: "PUT", body: JSON.stringify(data) });
export const del = (url) => request(url, { method: "DELETE" });

/*
 * Calendar dates, handled carefully.
 *
 * A day here is a label — "what did I eat on the 28th" — not an instant, and
 * mixing the two is the bug this file used to have. `new Date("2026-08-28T00:00:00")`
 * parses as *local* midnight, and `.toISOString()` then formats it as *UTC*.
 * Anywhere east of Greenwich that lands on the previous evening, so the date
 * came back a day earlier than it went in.
 *
 * In India, +5:30, that meant stepping forward a day landed on the same date —
 * the arrow looked broken — and stepping back moved two.
 *
 * So: parse as UTC, do the arithmetic in UTC, format from UTC. The only place
 * the local clock is consulted is `today`, which is the one function that
 * genuinely asks what date it is *here*.
 */

/** Today, on the wall clock of whoever is holding the phone. */
export function today() {
  const d = new Date();
  // Shift by the offset so the UTC getters read out the local date.
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Move a calendar date by whole days. Timezone-independent. */
export const shiftDate = (iso, days) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function prettyDate(iso) {
  const t = today();
  if (iso === t) return "Today";
  if (iso === shiftDate(t, -1)) return "Yesterday";
  if (iso === shiftDate(t, 1)) return "Tomorrow";

  // Formatted in UTC too, or the label can disagree with the date it names.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

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
async function servedLocally(url, init) {
  const demo = await import("@/lib/demo");
  const method = (init?.method ?? "GET").toUpperCase();
  const parsed = new URL(url, "http://local");
  const path = parsed.pathname;
  const payload = init?.body ? JSON.parse(String(init.body)) : {};

  if (path === "/api/profile") {
    if (method === "GET") return demo.demoProfile();
    if (method === "PUT") return { profile: demo.demoSaveProfile(payload).profile };
  }

  if (path === "/api/day") {
    const date = parsed.searchParams.get("date") ?? payload.date ?? today();
    if (method === "GET") return demo.demoDay(date);
    if (method === "PUT") {
      const { date: _d, ...patch } = payload;
      void _d;
      demo.demoSaveDay(date, patch);
      return { day: demo.demoDay(date).day };
    }
  }

  if (path === "/api/diary") {
    if (method === "POST") {
      if (!payload.per_100g) {
        throw new ApiError(
          "Standalone mode can only log foods you have picked from a search " +
            "result or entered by hand.",
          400,
        );
      }
      return {
        entry: demo.demoAddEntry({
          date: payload.date ?? today(),
          name: payload.name,
          brand: payload.brand,
          grams: Number(payload.grams),
          per100g: payload.per_100g,
          source: payload.source ?? "custom",
          sourceId: payload.source_id,
          confidence: payload.confidence,
          meal: payload.meal,
        }),
      };
    }
    if (method === "DELETE") {
      const id = parsed.searchParams.get("id") ?? "";
      return { deleted: demo.demoDeleteEntry(id) };
    }
  }

  if (path === "/api/plan" && method === "GET") {
    return demo.demoPlan(parsed.searchParams.get("date") ?? today());
  }

  /* Everything else — Macro AI, photo recognition, progress photos, saved
     workout history — genuinely needs a server, and says so rather than
     pretending. Sets logged in standalone mode live only in the page. */
  if (
    path.startsWith("/api/chat") ||
    path.startsWith("/api/coach") ||
    path.startsWith("/api/progress") ||
    path.startsWith("/api/workouts")
  ) {
    throw new ApiError("This part needs the backend connected. See README, sections 1 and 2.", 503);
  }

  return MISS;
}
