"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, ArrowRight, Loader2 } from "lucide-react";
import { AuthError, useAuth } from "@/components/AuthProvider";

/**
 * Sign in with Google, Apple, email or phone.
 *
 * Apple is behind a flag because it cannot be switched on the way the others
 * can: it needs a paid Apple Developer membership, a Services ID and a signing
 * key, and until those exist the button can only fail. Offering a sign-in
 * method that always errors is worse than not offering it, so it appears only
 * once NEXT_PUBLIC_APPLE_SIGN_IN is set.
 *
 * All four are offered because the app follows someone for months — losing
 * access to a year of training history because you cannot remember which
 * button you pressed the first time is the worst possible failure here.
 */

type Mode = "choose" | "email" | "phone";

/**
 * The real marks, not lookalikes.
 *
 * lucide dropped brand icons, and the nearest substitutes were a globe for
 * Google and a piece of fruit for Apple — neither of which is the thing
 * people scan for. Both companies require their own mark on these buttons
 * in any case.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.02-2.69 2.2-3.98 2.3-4.05-1.25-1.83-3.2-2.08-3.89-2.1-1.65-.17-3.23.97-4.07.97-.84 0-2.13-.95-3.5-.92-1.8.03-3.47 1.05-4.4 2.66-1.87 3.25-.48 8.06 1.35 10.7.89 1.29 1.95 2.74 3.35 2.69 1.34-.06 1.85-.87 3.47-.87s2.08.87 3.5.84c1.44-.03 2.36-1.32 3.24-2.61 1.02-1.5 1.44-2.95 1.47-3.02-.03-.02-2.82-1.08-2.84-4.29zM14.47 4.6c.74-.9 1.24-2.15 1.1-3.4-1.07.05-2.36.71-3.13 1.61-.69.8-1.29 2.07-1.13 3.3 1.2.09 2.41-.61 3.16-1.51z" />
    </svg>
  );
}

/** Apple sign-in needs paid Apple Developer setup that no env var can fake. */
const APPLE_READY = process.env.NEXT_PUBLIC_APPLE_SIGN_IN === "1";

export function SignIn() {
  const { signInWithGoogle, signInWithApple, signInWithEmail, createAccount,
          startPhoneSignIn, ensureSession, configured } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";

  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isNew, setIsNew] = useState(false);

  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState<((c: string) => Promise<void>) | null>(null);

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
  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key); setError("");
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
        <p role="alert" className="rounded-xl border border-[var(--color-bad)]/40 bg-[var(--color-bad)]/10 px-4 py-3 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="space-y-2.5">
          <button
            id="phone-recaptcha"
            onClick={() => run("google", signInWithGoogle)}
            disabled={busy !== null}
            className="btn btn-ghost w-full"
          >
            {busy === "google" ? <Loader2 className="animate-spin" size={18} /> : <GoogleMark />}
            Continue with Google
          </button>
          {APPLE_READY && (
            <button onClick={() => run("apple", signInWithApple)} disabled={busy !== null}
                    className="btn btn-ghost w-full">
              {busy === "apple" ? <Loader2 className="animate-spin" size={18} /> : <AppleMark />}
              Continue with Apple
            </button>
          )}
          <button onClick={() => setMode("email")} className="btn btn-ghost w-full">
            <Mail size={18} /> Continue with email
          </button>
          <button onClick={() => setMode("phone")} className="btn btn-ghost w-full">
            <Phone size={18} /> Continue with phone
          </button>
        </div>
      )}

      {mode === "email" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("email", () => isNew ? createAccount(email, password, name) : signInWithEmail(email, password));
          }}
        >
          {isNew && (
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
          )}
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="field" value={email}
                   onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={8} className="field" value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   autoComplete={isNew ? "new-password" : "current-password"} />
          </div>
          <button type="submit" disabled={busy !== null} className="btn btn-primary w-full">
            {busy === "email" ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            {isNew ? "Create account" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm text-[var(--color-mute)]">
            <button type="button" onClick={() => setIsNew(!isNew)} className="underline">
              {isNew ? "I already have an account" : "Create an account"}
            </button>
            <button type="button" onClick={() => { setMode("choose"); setError(""); }}>Back</button>
          </div>
        </form>
      )}

      {mode === "phone" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirm) {
              // Firebase attaches its invisible reCAPTCHA to this button.
              run("phone", async () => {
                const verify = await startPhoneSignIn(phone, "send-otp");
                // Stored behind a thunk: setState calls a bare function argument.
                setConfirm(() => verify);
              });
            } else {
              run("otp", () => confirm(code));
            }
          }}
        >
          <div>
            <label className="label" htmlFor="phone">Phone number</label>
            <input id="phone" type="tel" required className="field num" value={phone}
                   onChange={(e) => setPhone(e.target.value)} autoComplete="tel"
                   placeholder="+91 98765 43210" disabled={confirm !== null} />
            <p className="mt-1.5 text-xs text-[var(--color-mute)]">Include the country code.</p>
          </div>

          {confirm && (
            <div>
              <label className="label" htmlFor="otp">Six-digit code</label>
              <input id="otp" inputMode="numeric" required className="field num tracking-[0.4em]"
                     value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                     autoComplete="one-time-code" />
            </div>
          )}

          <button id="send-otp" type="submit" disabled={busy !== null} className="btn btn-primary w-full">
            {busy ? <Loader2 className="animate-spin" size={18} /> : <ArrowRight size={18} />}
            {confirm ? "Verify" : "Send code"}
          </button>
          <button type="button" onClick={() => { setMode("choose"); setConfirm(null); setError(""); }}
                  className="w-full text-sm text-[var(--color-mute)]">
            Back
          </button>
        </form>
      )}
    </div>
  );
}
