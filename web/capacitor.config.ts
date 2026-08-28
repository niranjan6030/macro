import type { CapacitorConfig } from "@capacitor/cli";

/*
 * The iOS and Android apps are native shells around the deployed site.
 *
 * Why not a static export: the app is genuinely dynamic. Targets are computed
 * per request from a profile that changes, the diary is per-user, and the
 * nutrition lookups hit two external databases. A bundled static build would
 * ship a snapshot that is wrong by the second weigh-in.
 *
 * What makes it more than a web view — and what Apple's guideline 4.2 is
 * actually asking about: the native camera for the food and progress photos,
 * haptics on logging a set, a native splash screen, and the system status
 * bar. On a phone, in a gym, those are the difference between an app and a
 * bookmark.
 *
 * Point MACRO_APP_URL at your deployment before running `npx cap sync`.
 */
const liveUrl = process.env.MACRO_APP_URL ?? "https://macro.app";

const config: CapacitorConfig = {
  appId: "app.macro",
  appName: "Macro",
  webDir: "public",          // fallback assets only; the shell loads liveUrl
  server: {
    url: liveUrl,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#06080c",
    scrollEnabled: true,
  },
  android: {
    backgroundColor: "#06080c",
    // Firebase phone auth opens a reCAPTCHA flow that needs a real browser
    // context; allowing mixed content here breaks it less often than not.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#06080c",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#06080c",
    },
  },
};

export default config;
