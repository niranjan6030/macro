/**
 * Is this deployment actually wired up?
 *
 * Reads .env.local, then goes and *uses* every credential it finds rather
 * than merely checking it is present. A key that is set but wrong is the
 * failure mode that wastes an afternoon: the app starts, the page renders,
 * and the first save fails with something unhelpful.
 *
 * Nothing secret is printed. Values are reported as present, valid, or
 * broken — never echoed — so this is safe to run with someone watching.
 *
 * Run: npm run doctor
 */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = {};
try {
  const text = await readFile(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  console.log("No web/.env.local found. Copy web/.env.example to web/.env.local first.\n");
}
Object.assign(env, Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== undefined),
));

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); failures++; };
const info = (m) => console.log(`    ${m}`);
let failures = 0;

const set = (k) => Boolean(env[k] && env[k].length > 0);

/* ------------------------------------------------------------------ */
console.log("\n\x1b[1mFirebase — sign-in\x1b[0m");

const usingEmulator = set("FIREBASE_AUTH_EMULATOR_HOST");
if (usingEmulator) {
  ok(`Auth emulator at ${env.FIREBASE_AUTH_EMULATOR_HOST}`);
  info("Local only. Nobody can sign in to a deployed build this way.");
  try {
    const res = await fetch(`http://${env.FIREBASE_AUTH_EMULATOR_HOST}/`);
    if (res.ok) ok("The emulator is running");
    else bad("The emulator is not answering — run: npm run emulator");
  } catch {
    bad("The emulator is not running — run: npm run emulator (needs Java)");
  }
} else {
  const web = [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missing = web.filter((k) => !set(k));
  if (missing.length) {
    bad(`Web config incomplete — missing ${missing.join(", ")}`);
    info("Firebase console → Project settings → General → Your apps → Web app");
  } else {
    ok("Web config present");

    /* Which providers are switched on is not public information — the
       /v1/projects endpoint returns only the project id and the authorised
       domains. An earlier version of this read a `signIn.email.enabled` field
       from it, which does not exist, so it reported email sign-in as OFF on
       every project ever checked, including ones where it plainly worked.
       
       Instead, probe it: attempt to sign in as an address that cannot exist
       and read the error. A disabled provider answers OPERATION_NOT_ALLOWED;
       an enabled one gets as far as rejecting the credentials. Nothing is
       created either way. */
    try {
      const probe = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: "macro-doctor-probe@invalid.invalid",
            password: "not-a-real-password",
            returnSecureToken: true,
          }),
        },
      );
      const body = await probe.json();
      const message = body?.error?.message ?? "";

      if (/API_KEY_INVALID|API key not valid/i.test(message)) {
        bad("The API key was rejected. Check NEXT_PUBLIC_FIREBASE_API_KEY.");
      } else if (/OPERATION_NOT_ALLOWED/.test(message)) {
        bad("Email/password sign-in is OFF");
        info("Authentication → Sign-in method → Email/Password → Enable");
      } else {
        ok("The API key works and email/password sign-in is on");
      }
    } catch (e) {
      bad(`Could not reach Firebase: ${e.message}`);
    }

    /* Authorised domains. OAuth providers refuse to run on a domain that is
       not listed, and the failure at sign-in time says almost nothing useful,
       so it is worth surfacing here. */
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      );
      if (res.ok) {
        const { authorizedDomains = [] } = await res.json();
        ok(`Authorised for: ${authorizedDomains.join(", ")}`);
        info("Google sign-in only works on these. Add your deployed domain before launch.");
      }
    } catch { /* already reported above */ }
  }
}

/* ------------------------------------------------------------------ */
console.log("\n\x1b[1mFirebase — server credentials\x1b[0m");

if (usingEmulator) {
  ok("Not needed against the emulator");
} else if (set("FIREBASE_SERVICE_ACCOUNT")) {
  try {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    if (!sa.private_key || !sa.client_email) throw new Error("missing private_key or client_email");
    ok(`Service account for ${sa.project_id ?? "unknown project"}`);
    if (sa.project_id && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        && sa.project_id !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      bad(`It belongs to "${sa.project_id}" but the web config is for "${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}"`);
    }
  } catch (e) {
    bad(`FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${e.message}`);
    info("Paste the whole downloaded file on one line, quotes and all.");
  }
} else if (set("FIREBASE_CLIENT_EMAIL") && set("FIREBASE_PRIVATE_KEY")) {
  ok("Service account set as three separate fields");
  if (!env.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")) {
    bad("FIREBASE_PRIVATE_KEY does not look like a key — keep the \\n sequences intact");
  }
} else {
  bad("No server credentials. Nobody will be able to stay signed in.");
  info("Project settings → Service accounts → Generate new private key");
  info("Then: FIREBASE_SERVICE_ACCOUNT={paste the whole JSON on one line}");
}

/* ------------------------------------------------------------------ */
console.log("\n\x1b[1mSupabase — database\x1b[0m");

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  bad("Not configured — the app will run, but nothing will be saved");
  info("Supabase → Project settings → API");
} else if (!service) {
  bad("SUPABASE_SERVICE_ROLE_KEY is missing");
  info("Every write goes through it. Without it, saving fails.");
} else {
  ok("Keys present");
  try {
    const db = createClient(url, service, { auth: { persistSession: false } });

    // Ask for one row from every table the app writes to. A missing table
    // means the schema has not been run; a permissions error means the key
    // is the anon one rather than the service role.
    const tables = [
      "profiles", "days", "diary_entries", "workouts", "workout_sets",
      "progress_photos", "measurements", "custom_foods", "coach_notes",
    ];
    const missing = [];
    let reachable = true;

    for (const t of tables) {
      const { error } = await db.from(t).select("*").limit(1);
      if (!error) continue;
      if (/does not exist|schema cache/i.test(error.message)) missing.push(t);
      else { bad(`${t}: ${error.message}`); reachable = false; }
    }

    if (!reachable) {
      info("If that says permission denied, the key is probably the anon key.");
    } else if (missing.length === tables.length) {
      bad("Connected, but no tables — the schema has not been run");
      info("Open the Supabase SQL editor and run supabase/schema.sql");
    } else if (missing.length) {
      bad(`Connected, but missing: ${missing.join(", ")}`);
      info("Re-run supabase/schema.sql — it is safe to run again");
    } else {
      ok("Connected, and every table is there");
    }

    // Progress photos need a private bucket that the schema cannot create.
    const { data: buckets, error: bErr } = await db.storage.listBuckets();
    if (bErr) {
      bad(`Could not list storage buckets: ${bErr.message}`);
    } else {
      const progress = buckets.find((b) => b.name === "progress");
      if (!progress) {
        bad('No "progress" storage bucket — progress photos will fail');
        info("Storage → New bucket → name it progress → leave Public unticked");
      } else if (progress.public) {
        bad('The "progress" bucket is PUBLIC — anyone with a URL could read the photos');
        info("Storage → progress → Settings → turn off Public");
      } else {
        ok('Private "progress" bucket ready');
      }
    }
  } catch (e) {
    bad(`Could not reach Supabase: ${e.message}`);
  }
}

/* ------------------------------------------------------------------ */
console.log("\n\x1b[1mOptional\x1b[0m");

if (set("ANTHROPIC_API_KEY")) ok("Anthropic — photo reader, Macro AI and the weekly review are on");
else if (set("GEMINI_API_KEY")) {
  ok("Gemini — photo reader, Macro AI and the weekly review are on");
  info("On Google's free tier your prompts may be used to train their models.");
} else {
  info("No AI key. Photo logging and Macro AI are off; everything else works.");
}

if (set("USDA_API_KEY")) ok("USDA — whole foods searchable");
else info("No USDA key (free). Packaged food and the Indian table still work.");

console.log(
  failures === 0
    ? "\n\x1b[32mReady.\x1b[0m Everything the app needs is connected.\n"
    : `\n\x1b[33m${failures} thing${failures === 1 ? "" : "s"} to fix.\x1b[0m See above.\n`,
);
process.exitCode = failures === 0 ? 0 : 1;
