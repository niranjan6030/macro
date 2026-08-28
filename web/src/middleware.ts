import { NextResponse, type NextRequest } from "next/server";

/*
 * Edge middleware cannot run firebase-admin, so this is a presence check on
 * the session cookie, not a verification. Its only job is to stop a signed-out
 * person loading a page that would immediately tell them to sign in.
 *
 * The real check is `requireUser()` in every route handler. Forging this
 * cookie gets you an empty page shell and a 401 from every API call.
 */
export function middleware(req: NextRequest) {
  // Nothing to sign in to without a Firebase project; let the page explain.
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return NextResponse.next();

  if (!req.cookies.has("macro_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/account";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/food/:path*", "/train/:path*", "/progress/:path*", "/coach/:path*", "/onboarding"],
};
