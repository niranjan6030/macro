"use client";

import { type FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  GoogleAuthProvider,
  OAuthProvider,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from "firebase/auth";

/* Firebase is optional: without the config the app still works, it
   just cannot sign anyone in. Every caller checks `firebaseConfigured`
   rather than assuming an app exists. */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  config.apiKey && config.authDomain && config.projectId && config.appId,
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  if (!firebaseConfigured) return null;
  if (auth) return auth;

  app = getApps().length ? getApp() : initializeApp(config as Record<string, string>);
  auth = getAuth(app);

  /* Local development against the Firebase Auth emulator, so the whole
     sign-in flow can be exercised before anyone creates a real project.
     Set NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST to switch it on. */
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator) {
    connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
  }

  // Survive a page reload; the server session cookie is what actually
  // authorises requests, but this keeps the UI from flashing signed-out.
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Storage disabled (private mode). Auth still works for the session.
  });

  return auth;
}

export function googleProvider(): GoogleAuthProvider {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}

export function appleProvider(): OAuthProvider {
  const p = new OAuthProvider("apple.com");
  p.addScope("email");
  p.addScope("name");
  return p;
}

/** True when this build points at the local Auth emulator. */
export const usingAuthEmulator = Boolean(
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
);

/** Firebase error codes are not written for the people reading them. */
export function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/invalid-email": return "That email address does not look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "That email and password do not match.";
    case "auth/email-already-in-use": return "There is already an account with that email — sign in instead.";
    case "auth/weak-password": return "Use at least eight characters.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request": return "";      // they changed their mind; say nothing
    case "auth/popup-blocked": return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
    case "auth/too-many-requests": return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":
      // In development the overwhelmingly likely cause is the emulator not
      // being up, and "check your connection" sends people the wrong way.
      return usingAuthEmulator
        ? "Cannot reach the Firebase Auth emulator. Start it with `npm run emulator` in another terminal."
        : "Network problem — check your connection.";
    case "auth/operation-not-allowed": return "That sign-in method is not enabled on this Firebase project yet.";
    // Worth naming the domain. This one cost an afternoon once: Google, Apple
    // and phone all fail here — phone because its reCAPTCHA will not load —
    // while email carries on working, which makes it look like three separate
    // faults instead of one missing line in a list.
    case "auth/unauthorized-domain":
      return typeof window !== "undefined"
        ? `${window.location.hostname} is not in this Firebase project's authorised domains. Add it under Authentication → Settings.`
        : "This domain is not in the Firebase project's authorised domains.";
    default: return "Could not sign you in. Try again.";
  }
}
