import "server-only";
import { type App, cert, getApps, initializeApp } from "firebase-admin/app";
import { type DecodedIdToken, getAuth } from "firebase-admin/auth";
import { cookies } from "next/headers";

/*
 * Server-side identity.
 *
 * The browser holds a Firebase ID token, but ID tokens are short-lived and
 * awkward to send with every navigation. So on sign-in the client posts its
 * token once to /api/auth/session, which exchanges it for an httpOnly
 * session cookie — that cookie is what server routes actually trust.
 */

export const SESSION_COOKIE = "macro_session";
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;   // Firebase caps at 14 days

function serviceAccount(): Record<string, string> | null {
  // Either a whole JSON blob, or the three fields separately — hosts differ
  // in which is easier to paste into their dashboard.
  const blob = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (blob) {
    try {
      return JSON.parse(blob);
    } catch {
      console.error("[firebase] FIREBASE_SERVICE_ACCOUNT is not valid JSON");
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) return null;

  return {
    projectId,
    clientEmail,
    // Dashboards store the key with literal \n sequences.
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

let cached: App | null = null;

/** True when pointed at the local Auth emulator, which needs no real keys. */
export function usingAuthEmulator(): boolean {
  return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function adminApp(): App | null {
  if (cached) return cached;

  if (usingAuthEmulator()) {
    // The emulator accepts any project id and signs nothing, so credentials
    // would be meaningless here.
    const projectId =
      process.env.FIREBASE_PROJECT_ID ??
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      "demo-macro";
    cached = getApps().length ? getApps()[0] : initializeApp({ projectId });
    return cached;
  }

  const creds = serviceAccount();
  if (!creds) return null;

  cached = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(creds as Parameters<typeof cert>[0]) });
  return cached;
}

export function firebaseAdminConfigured(): boolean {
  return adminApp() !== null;
}

/** Swap a fresh ID token for a session cookie value. */
export async function createSessionCookie(idToken: string): Promise<string | null> {
  const app = adminApp();
  if (!app) return null;
  try {
    return await getAuth(app).createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
  } catch (e) {
    console.error("[firebase] could not mint session cookie", e);
    return null;
  }
}

/**
 * The signed-in user for this request, or null.
 *
 * `checkRevoked` costs a round trip to Google but means a disabled account
 * or a signed-out-everywhere action takes effect immediately rather than
 * whenever the cookie happens to expire.
 */
export async function currentUser(): Promise<DecodedIdToken | null> {
  const app = adminApp();
  if (!app) return null;

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    return await getAuth(app).verifySessionCookie(cookie, true);
  } catch {
    // Expired, revoked, or tampered with. All mean "not signed in".
    return null;
  }
}

/** Guard for route handlers that need a signed-in person. */
export async function requireUser(): Promise<
  { user: DecodedIdToken } | { response: Response }
> {
  if (!firebaseAdminConfigured()) {
    return {
      response: Response.json(
        { error: "Sign-in is not configured on this deployment." },
        { status: 503 },
      ),
    };
  }
  const user = await currentUser();
  if (!user) {
    return { response: Response.json({ error: "Please sign in." }, { status: 401 }) };
  }
  return { user };
}
