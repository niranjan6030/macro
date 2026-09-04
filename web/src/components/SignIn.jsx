"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, ArrowRight, Loader2 } from "lucide-react";
import { AuthError, useAuth } from "@/components/AuthProvider";

/**
 * Sign in with Google or email.
 *
 * Two, not one, because the app follows someone for months — losing a year of
 * training history because you cannot remember which button you pressed the
 * first time is the worst failure available here.
 *
 * Apple was here and is gone. Sign in with Apple cannot be switched on the
 * way Google can: it needs a paid Apple Developer membership for the Services
 * ID and the signing key, and without those the provider can be *enabled* in
 * Firebase while having no client id and no secret — which is exactly the
 * state it was in. The button rendered, and every person who pressed it got
 * an error. A sign-in method that cannot succeed is worse than one that is
 * not offered.
 *
 * Phone went earlier, for a different reason: it was the only method that
 * cost money per attempt. Anyone who signed in either way still has their
 * account and reaches it with email.
 */

/**
 * The real mark, not a lookalike.
 *
 * lucide dropped brand icons and the nearest substitute was a globe, which is
 * not the thing people scan for. Google requires its own mark on this button
 * in any case.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}


export function SignIn() {
  const {
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    ensureSession,
    configured,
  } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";

  const [mode, setMode] = useState("choose");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);

  if (!configured) {
    return (
      <div className="card p-5 text-sm text-[var(--color-mute)]">
        Sign-in is not configured on this deployment. Add your Firebase keys to
        <code className="mx-1 text-[var(--color-chalk)]">.env.local</code>
        and restart — see README, section 1.
      </div>
    );
  }

  /* Every path ends the same way: wait for the server session cookie before
     navigating, or the next page loads as a signed-out shell. */
  async function run(key, fn) {
    setBusy(key);
    setError("");
    try {
      await fn();
      await ensureSession();
      router.replace(next);
      router.refresh();
    } catch (e) {
      // An empty message means they closed the popup; that is not an error.
      if (e instanceof AuthError && e.message) setError(e.message);
      else if (!(e instanceof AuthError)) setError("Could not sign you in. Try again.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 px-4 py-3 text-sm text-[var(--color-bad)]"
        >
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="space-y-2.5">
          <button
            onClick={() => run("google", signInWithGoogle)}
            disabled={busy !== null}
            className="btn btn-ghost w-full"
          >
            {busy === "google" ? <Loader2 className="animate-spin" size={18} /> : <GoogleMark />}
            Continue with Google
          </button>
          <button onClick={() => setMode("email")} className="btn btn-ghost w-full">
            <Mail size={18} /> Continue with email
          </button>
        </div>
      )}

      {mode === "email" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("email", () =>
              isNew ? createAccount(email, password, name) : signInWithEmail(email, password),
            );
          }}
        >
          {isNew && (
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isNew ? "new-password" : "current-password"}
            />
          </div>
          <button type="submit" disabled={busy !== null} className="btn btn-primary w-full">
            {busy === "email" ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <ArrowRight size={18} />
            )}
            {isNew ? "Create account" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm text-[var(--color-mute)]">
            <button type="button" onClick={() => setIsNew(!isNew)} className="underline">
              {isNew ? "I already have an account" : "Create an account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError("");
              }}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
