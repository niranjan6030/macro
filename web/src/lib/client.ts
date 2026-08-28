"use client";

/**
 * Talking to our own API.
 *
 * Every route answers `{ error }` on failure, so this turns that into a
 * thrown Error with the server's own wording. Server messages are written
 * for the person reading them; replacing them with "Request failed" here
 * would throw away the useful half.
 */

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
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
