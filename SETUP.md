# Connecting Macro to Firebase and Supabase

Everything in the app is already written against these two services. What is
missing is the accounts, which have to be yours — nobody can create them on
your behalf, and the secret keys should never be pasted into a chat window.

There is a checker for all of it. At any point:

```bash
cd web && npm run doctor
```

It uses every key it finds rather than just looking at it, and reports what is
missing, what is wrong, and where to fix it. It never prints a secret, so it is
safe to run with someone looking over your shoulder.

---

## 1. Firebase — who people are

**Create the project.** <https://console.firebase.google.com> → *Add project*.
Call it whatever you like. Google Analytics is not needed.

**Turn on the ways people sign in.** *Build → Authentication → Get started*,
then under *Sign-in method* enable:

| Method | What it needs |
|---|---|
| Email/Password | Nothing. Enable it. |
| Google | Nothing — pick a support email. |
| Apple | An Apple Developer account (£79/yr), a Services ID and a signing key. |

Enable at least **Email/Password** and **Google**; the app offers whichever are
on and the others simply fail with a clear message.

Phone sign-in was removed. It was the only method that cost money per attempt,
the only one requiring an invisible reCAPTCHA anchored to a button elsewhere on
the page, and it put an SMS provider in the middle of the one flow that must
not break. Leave it **disabled** in the console as well as absent from the UI —
an enabled provider with no button in front of it is still reachable through
the API, and the bill for that is real.

**Get the web config.** *Project settings → General → Your apps → Web app*
(click `</>` if there isn't one). Copy the six values into `web/.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

These are public by design. Firebase's security comes from the authorised
domain list, not from hiding them.

**Get the server key.** *Project settings → Service accounts → Generate new
private key*. A JSON file downloads. This one **is** secret. Put the whole
thing on one line:

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...", ... }
```

Without it people can sign in but the server cannot verify them, so nobody
stays signed in past a page load.

**Delete the two emulator lines** from `web/.env.local` once the real values
are in, or the app will keep talking to the local emulator.

**Authorised domains.** *Authentication → Settings → Authorised domains* — add
your deployed domain. `localhost` is already there.

---

## 2. Supabase — where everything is kept

**Create the project.** <https://supabase.com/dashboard> → *New project*.
Choose the region closest to you; for India, Mumbai (`ap-south-1`).

**Run the schema.** *SQL Editor → New query*, paste all of
`supabase/schema.sql`, and run it. It creates nine tables, a totals view, and
turns on row-level security everywhere. It is safe to run again later.

The schema is tested before it reaches you — `npm run check:schema` applies it
to a real Postgres and exercises it, so a syntax error cannot get this far.

**Make the photo bucket.** *Storage → New bucket*, name it exactly `progress`,
and **leave "Public bucket" unticked**. Progress photos are the most personal
thing the app holds; they are served through links that expire in ten minutes.

**Copy the keys.** *Project settings → API*:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service role key bypasses row-level security. It is server-only and must
never appear in anything the browser downloads.

**A note on how these two fit together.** Identity is Firebase's job and
storage is Supabase's, so Supabase never sees a logged-in user —
`auth.uid()` is always null. Every table is therefore locked shut to the anon
key, and all reads and writes go through the app's own route handlers, which
verify the Firebase session cookie first and then scope every query by that
uid themselves.

---

## 3. Optional

**AI** — one key switches on photo logging, Macro AI and the weekly review:

Gemini's free tier is generous but genuinely busy: the newest flash model
frequently answers 503 "experiencing high demand". Macro handles that by
falling back through older flash models and remembering for two minutes which
ones are busy, so only the first request of a session pays for the discovery.
Expect roughly 10-20 seconds for a reply once warm.


```
ANTHROPIC_API_KEY=      # paid, a fraction of a cent per photo
GEMINI_API_KEY=         # aistudio.google.com — has a free tier
```

On Gemini's **free** tier your prompts may be used to train Google's models.
This app sends photographs of your meals and figures about your body. Progress
photos are never sent to any model either way, but bear it in mind.

**USDA** — free, improves whole-food search:
<https://fdc.nal.usda.gov/api-key-signup.html>

```
USDA_API_KEY=
```

Without any of these the app still runs. Packaged food, the Indian food table,
training, targets and the projection all work.

---

## 4. Check it

```bash
cd web
npm run doctor      # every key, actually used
npm run dev
```

`doctor` will tell you if the schema has not been run, if the storage bucket is
missing or public, if the service account belongs to a different project than
the web config, or if email sign-in is still switched off.

---

## Developing without any of it

`web/.env.local` ships pointing at the Firebase Auth emulator, which needs no
account:

```bash
npm run emulator    # terminal one — needs Java
npm run dev         # terminal two
```

Sign-in works completely, including the server session cookie. Without
Supabase, nothing is saved between reloads.

---

## Deploying

The project is on Vercel, with the repository connected, so a push to `main`
deploys. The eleven environment variables above have to exist there too —
`vercel env add` for each, across production, preview and development.

Two things bite on the first deploy and neither is obvious from the error:

**Deployment Protection.** Vercel switches this on for new projects, and every
request — pages and API alike — redirects to a Vercel login. The site looks
like it is up, because following the redirect returns 200. Turn it off under
Settings → Deployment Protection, or the app is visible only to you.

**Authorised domains.** Firebase refuses OAuth from any domain not on its
list, so Google sign-in fails on the Vercel URL until you add it: Firebase
console → Authentication → Settings → Authorised domains.

## Migrations

`supabase/schema.sql` uses `create table if not exists`, which is right for a
fresh database and useless for one that already has the tables — it skips
them and any new column never arrives. Changes to an existing database go in
`supabase/migrations/` as explicit `alter table` statements.

Run them in the Supabase SQL editor, oldest first. They are written to be
safe to run twice.

```
supabase/migrations/001_photo_vault.sql
```

`npm run check:migration` applies each one to a throwaway Postgres built from
the previous schema and asserts it did what it says.

## The retention sweep

Progress photos expire. `/api/progress/purge` deletes the bytes of anything
past its date and leaves the row — the date, the pose and the weight, which
is what the chart is drawn from. Vercel Cron calls it at 03:00 daily
(`web/vercel.json`) and authenticates with `CRON_SECRET`:

```
vercel env add CRON_SECRET production
```

Vercel sends that value as `Authorization: Bearer …` on cron invocations.
Without the variable set the endpoint refuses everyone, including the cron,
which fails closed rather than deleting on anyone's request.

## The photo vault

Progress photos are encrypted in the browser before upload, with an AES-GCM
key derived from a passphrase by PBKDF2. The passphrase never leaves the
device and the server stores ciphertext, a nonce, and a salt.

This is deliberate and it has a consequence worth understanding before you
run this for anyone: **there is no operator recovery path.** Whoever holds
the database, the storage bucket, the service key and a backup still cannot
open a single photo. Neither can you. A reset you could perform is a reset
you could be compelled to perform.
