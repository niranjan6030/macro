import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  createSessionCookie,
  currentUser,
  firebaseAdminConfigured,
} from "@/lib/firebase/admin";

/** Who is signed in, as far as the server is concerned. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({
    configured: firebaseAdminConfigured(),
    signedIn: Boolean(user),
    user: user
      ? {
          uid: user.uid,
          email: user.email ?? null,
          phone: user.phone_number ?? null,
          name: user.name ?? null,
        }
      : null,
  });
}

/** Exchange a Firebase ID token for an httpOnly session cookie. */
export async function POST(req: Request) {
  if (!firebaseAdminConfigured()) {
    return NextResponse.json(
      { error: "Firebase Admin credentials are not set on the server. See README, section 1." },
      { status: 503 },
    );
  }

  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== "string" || idToken.length < 20) {
    return NextResponse.json({ error: "Missing sign-in token." }, { status: 400 });
  }

  const session = await createSessionCookie(idToken);
  if (!session) {
    return NextResponse.json({ error: "That sign-in could not be verified." }, { status: 401 });
  }

  (await cookies()).set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return NextResponse.json({ signedIn: true });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.json({ signedIn: false });
}
