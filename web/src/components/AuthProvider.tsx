"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import {
  type User,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from "firebase/auth";
import {
  appleProvider, firebaseConfigured, friendlyAuthError, getFirebaseAuth, googleProvider,
} from "@/lib/firebase/client";

interface AuthValue {
  configured: boolean;
  ready: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string, name?: string) => Promise<void>;
  /** Sends the OTP. Returns a confirm function to call with the code. */
  /** Resolves once the server session cookie exists. Await before navigating. */
  ensureSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export class AuthError extends Error {}

function wrap(e: unknown): never {
  const code = (e as { code?: string })?.code ?? "";
  const message = friendlyAuthError(code);
  throw new AuthError(message);
}

/**
 * Standing in for a signed-in person when there is no Firebase project.
 *
 * Every page gates on `user` before it will render anything, which is right
 * when there are accounts and wrong when there are not — with no project
 * configured there is nobody to sign in *as*, and the app would sit on the
 * sign-in screen forever refusing to show itself. This is that person: local
 * to this browser, owning the data in localStorage, and never sent anywhere.
 */
const LOCAL_USER = {
  uid: "local",
  displayName: null,
  email: null,
  phoneNumber: null,
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(firebaseConfigured ? null : LOCAL_USER);
  const [ready, setReady] = useState(!firebaseConfigured);

  /* Keep the httpOnly server session in step with the client's token.
     onIdTokenChanged fires on sign-in, sign-out and hourly refreshes, so
     the cookie never drifts out of date. */
  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;

    return onIdTokenChanged(auth, async (next) => {
      setUser(next);
      setReady(true);
      try {
        if (next) {
          const idToken = await next.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        } else {
          await fetch("/api/auth/session", { method: "DELETE" });
        }
      } catch {
        // Offline. The client is still signed in; the cookie catches up on
        // the next token refresh.
      }
    });
  }, []);

  /**
   * Exchange the current ID token for the server session cookie, and wait
   * for it.
   *
   * onIdTokenChanged does this too, but it fires whenever it likes — so
   * navigating straight after signing in used to race it. The middleware
   * would find no cookie, bounce back to /account, and it looked for all
   * the world like the sign-in had failed. Anything that redirects on
   * success awaits this first.
   */
  const ensureSession = useCallback(async () => {
    const auth = getFirebaseAuth();
    const current = auth?.currentUser;
    if (!current) return false;
    try {
      const idToken = await current.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const needAuth = () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new AuthError("Sign-in is not configured on this deployment.");
    return auth;
  };

  const signInWithGoogle = useCallback(async () => {
    try { await signInWithPopup(needAuth(), googleProvider()); } catch (e) { wrap(e); }
  }, []);

  const signInWithApple = useCallback(async () => {
    try { await signInWithPopup(needAuth(), appleProvider()); } catch (e) { wrap(e); }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try { await signInWithEmailAndPassword(needAuth(), email, password); } catch (e) { wrap(e); }
  }, []);

  const createAccount = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(needAuth(), email, password);
      if (name?.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    } catch (e) { wrap(e); }
  }, []);

  const signOut = useCallback(async () => {
    if (!firebaseConfigured) {
      // Nothing to sign out of; clearing the local diary is a separate,
      // deliberate action on the account screen.
      return;
    }
    const auth = getFirebaseAuth();
    if (auth) await fbSignOut(auth);
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    configured: firebaseConfigured,
    ready, user,
    signInWithGoogle, signInWithApple, signInWithEmail,
    createAccount, ensureSession, signOut,
  }), [ready, user, signInWithGoogle, signInWithApple, signInWithEmail,
       createAccount, ensureSession, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
