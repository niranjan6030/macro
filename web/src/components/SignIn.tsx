"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Phone, Apple, Globe, ArrowRight, Loader2 } from "lucide-react";
import { AuthError, useAuth } from "@/components/AuthProvider";

/**
 * Sign in with Google, Apple, email or phone.
 *
 * All four are offered because the app follows someone for months — losing
 * access to a year of training history because you cannot remember which
 * button you pressed the first time is the worst possible failure here.
 */

type Mode = "choose" | "email" | "phone";

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
            {busy === "google" ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
            Continue with Google
          </button>
          <button onClick={() => run("apple", signInWithApple)} disabled={busy !== null} className="btn btn-ghost w-full">
            {busy === "apple" ? <Loader2 className="animate-spin" size={18} /> : <Apple size={18} />}
            Continue with Apple
          </button>
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
