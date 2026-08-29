# Macro

Food, training and progress, in one app. Web, iOS and Android from a single
codebase.

Log a meal by photographing it, scanning a barcode, or searching for it. Train
to a programme that reads what you lifted last week and prescribes this week
accordingly. Watch the trend line rather than the scale. See when you will
actually get there.

---

## The one idea worth explaining first

**AI identifies the food. A database supplies the numbers.**

Ask a vision model how many calories are on a plate and it will tell you,
fluently and confidently, and it will be wrong. The screenshot that started
this project is a good illustration: a packet's protein and fibre both came
back as exactly 10.7 g. That is not a reading. It is a guess with a decimal
point on it.

So Macro splits the job:

| Step | Who does it | Why |
|---|---|---|
| "That's a chicken biryani, about 320 g" | Claude, via the vision API | Models are genuinely good at recognising food and estimating portions |
| "Chicken biryani is 186 kcal / 100 g" | Open Food Facts, USDA, or the built-in Indian table | Real measured composition, not recalled from training data |
| "320 g × 1.86 = 595 kcal" | `forGrams()`, in one place | Arithmetic belongs in code |
| "Is 320 g right?" | You, before it is logged | A portion estimate is a guess until a person confirms it |

The model is never asked for a calorie figure, and the prompt says so
explicitly. Nothing is written to your diary straight from a photo.

The same split runs through the weekly review: every number in it is computed
from your logged data first, and the model's only job is to write it up.

---

## What is in the box

**Food**
- Photograph a meal — it is split into its components, each with an editable weight
- Barcode lookup against Open Food Facts, the manufacturer's own declared panel
- Search across three sources at once, ranked by how trustworthy each one is
- A built-in table of Indian staples (dal, roti, idli, biryani, chai) as eaten,
  because neither remote database covers home cooking
- Enter a panel by hand for anything else
- Every entry shows where its numbers came from: **lab measured**, **from the
  packet**, or **estimate**

**Targets**
- BMR by Mifflin–St Jeor, or Katch–McArdle once body fat is known
- Training counted per session rather than as a blanket activity multiplier —
  the single biggest source of inflation in ordinary calculators
- Protein scaled to lean mass, not bodyweight
- Loss capped at 1% of bodyweight per week; gain capped far lower, because
  muscle cannot be built at the rate fat can be lost
- A hard floor below which it will not prescribe, whatever the arithmetic says

**Projection**
- Week-by-week simulation that recomputes expenditure from the new body each
  step, so the loss decelerates the way it really does
- Forbes partitioning of the change into fat and lean tissue
- Metabolic adaptation applied in a deficit
- If the target is not reachable at that intake, it says so instead of
  inventing a date

**Training**
- Pick what you actually did: Gym, HIIT, Cardio, Sport, Class, or daily life
- Gym drills down by split, by muscle, or by searching 65 exercises by name;
  anything can be added to the day on top of what was prescribed
- Everything else is logged by time, with the calorie cost from METs
  (Compendium of Physical Activities). **Net, not gross** — a MET figure
  includes the resting burn your maintenance already counts, and adding the
  gross number counts it twice. Two hours of walking is 420 kcal here and 588
  in most apps; the smaller number is the correct one
- Splits chosen by weekly frequency: three days gets full body, not
  push/pull/legs
- Double progression — reps first, then load, per exercise, from your last
  session for it
- Reps in reserve, estimated 1RM, weekly hard sets per muscle
- Rest days and cheat days are first-class, recorded rather than hidden

**The star**
- A four-pointed star turns behind every screen, driven by the scrollbar
- Its shape is an astroid — `x = cos³t, y = sin³t` — extended into three
  dimensions as a superellipsoid. The cubing is what pulls the sides inward
  into needle points; without it you get an ellipse
- Rendered as dust, not as a surface: seventy thousand points scattered over
  the geometry by triangle area and blended additively, so it is translucent,
  its edges feather away instead of stopping, and it brightens where it is
  dense. A fresnel term picks out the silhouette, which is the bright rim
- It does nothing else. No data feeds it and nothing reads from it

**The look**
- Monochrome, on black. The only colour in the app is the photograph of your
  own dinner
- Scrolling the home screen walks through the day — calories left, protein,
  carbs and fat, days to your goal — while the body turns behind it
- Display type is Instrument Serif italic

**Progress**
- Front, side and back photos in a private bucket, served through URLs that
  expire in ten minutes, never shown to the AI
- Then-and-now comparison per pose
- Tape measurements, with body fat derived by the US Navy method
- Bodyweight as a seven-day trend over the raw readings

---

## Getting it running

You need Node 20+.

```bash
cd web
npm install
npm run dev
```

That is the whole of it. **With no keys at all Macro runs standalone**: it
skips sign-in, keeps everything in your browser, and the core loop works —
onboarding, targets, the star, food search, logging, the rings, the
projection. Food search still reaches the real nutrition databases, because
those are public.

What standalone mode cannot do is sync between devices, recognise a photo, or
run Macro AI. Those need the sections below. Fill them in in order; each one
switches on the next layer, and nothing breaks while they are empty.

```bash
cp .env.example .env.local     # when you are ready to connect the backend
```

### 1. Firebase — sign-in

Create a project at [console.firebase.google.com](https://console.firebase.google.com).

1. **Authentication → Sign-in method** — enable Google, Apple, Email/Password
   and Phone. Each one you skip simply does not appear.
2. **Project settings → General → Your apps → Web** — copy the config into the
   six `NEXT_PUBLIC_FIREBASE_*` values.
3. **Project settings → Service accounts → Generate new private key** — paste
   the JSON into `FIREBASE_SERVICE_ACCOUNT` as one line.
4. **Authentication → Settings → Authorised domains** — add your deployment
   domain. `localhost` is there already.

The browser holds a short-lived ID token; on sign-in it is exchanged once at
`/api/auth/session` for an httpOnly session cookie, and that cookie is what
every server route actually trusts.

**No Firebase project yet?** Run the emulator instead:

```bash
npm run emulator
```

Then uncomment the two `*_AUTH_EMULATOR_HOST` lines in `.env.local`. The full
sign-in flow works, with no real project.

### 2. Supabase — the database

Create a project at [supabase.com](https://supabase.com).

1. **SQL Editor** — paste and run [`supabase/schema.sql`](supabase/schema.sql).
   It is idempotent, so re-running it after an upgrade is safe.
2. **Storage → New bucket** — name it `progress` and **uncheck "Public
   bucket"**. Progress photos must not sit behind a guessable URL.
3. **Project settings → API** — copy the URL, the anon key, and the
   service-role key into `.env.local`.

Identity is Firebase's, so Supabase's `auth.uid()` is never populated and RLS
cannot see who is asking. Every table is therefore closed to the anon key, and
all access runs through route handlers that verify the session cookie and then
scope the query by uid themselves. The service-role key never leaves the
server.

### 3. An AI key — photo recognition and Macro AI

Unlocks: photographing a meal, and Macro AI, the coach you can talk to.

Either provider works; whichever key is set is the one used.

| | Key | Cost |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` from [console.anthropic.com](https://console.anthropic.com) | Paid, fractions of a cent per photo |
| Google | `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com/apikey) | Free tier, with a rate limit |

**Read this before choosing free.** On Google's free tier your prompts and
responses may be used to improve their models. This app sends photographs of
your meals, and Macro AI sees your weight and your diary. On either paid tier
that does not happen. Progress photos are never sent to any model either way.

Without a key: search and barcode logging work exactly as well, and the weekly
review still reports all of your figures — it just is not written up.

### 4. USDA FoodData Central — whole foods

A [free key](https://fdc.nal.usda.gov/api-key-signup.html) into `USDA_API_KEY`.
Worth doing: it is the laboratory-measured source, and it is what makes
"150 g chicken breast" exact. Open Food Facts needs no key and is always on.

---

## Checking the maths

The equations are the part that has to be right, so they have their own
checks — worked by hand against the published formulae, not against whatever
the code currently returns.

```bash
npm run check
```

34 assertions covering BMR against Mifflin–St Jeor by hand, the safety caps,
that protein tracks lean mass, that the projection decelerates rather than
running in a straight line, that an unreachable target is refused rather than
given a date, the progression rules, and that implausible nutrition panels are
rejected by their Atwater arithmetic.

```bash
npm run check:sources
```

Nine more against the live nutrition sources. These need the network, which is
why they are separate. The one worth knowing about: Open Food Facts is full of
products that have been photographed but never transcribed, and they come back
with an empty panel that reads as *zero calories* — so a bag of crisps could be
logged as free. Every result is required to carry a real panel, and all 68 rows
of the Indian table are checked against their own Atwater arithmetic.

```bash
npm run lint      # ESLint, including the React compiler rules
npx tsc --noEmit  # types
npm run build     # production build
```

---

## Installing it on your phone

Macro is a progressive web app, which is the right shape for it: one codebase,
one deploy, no store review, and it updates the moment you push. Installed, it
runs full screen with no browser bar and opens offline.

- **Android / Chrome / Edge** — a card appears on the You screen with an
  **Install** button. Or use the browser's own ⋮ → *Install app*.
- **iPhone / Safari** — Apple has no install API, so it has to be done by
  hand: **Share** → **Add to Home Screen**. The You screen says so on iOS.

It needs to be served over HTTPS, which any real deployment is.

The Capacitor shells in `web/ios` and `web/android` still build if you ever
want to put it in a store — `npm run sync:ios`, `npm run sync:android`, with
`MACRO_APP_URL` pointing at your deployment. They are not the main path.

---

## Layout

```
supabase/schema.sql        Postgres schema, commented
web/src/lib/
  fitness/energy.ts        BMR, TDEE, macro targets
  fitness/projection.ts    week-by-week bodyweight simulation
  fitness/training.ts      exercise library, splits, progression
  fitness/physique.ts      composition -> the six builds
  three/star.ts            the astroid star
  three/dust.ts            scattering a surface into points
  nutrition/types.ts       the canonical per-100 g shape, and plausibility
  nutrition/indian.ts      Indian staples as eaten
  nutrition/openfoodfacts.ts, usda.ts, search.ts
  ai/identify.ts           photo → foods + portions (never calories)
  ai/coach.ts              findings computed in code, written up by the model
  db.ts                    every read and write, scoped by uid
web/src/components/
  Scene.tsx                the star, scroll-driven rotation, drifting dust
  Cosmos.tsx               grain and the corner frame
  Landing.tsx              the signed-out screen
  ScrollStory.tsx          the day, told as you scroll
web/src/app/api/           route handlers; each verifies the session first
web/src/app/               Today, Food, Train, Progress, Coach, onboarding
```

---

## Honest limits

- **Portion estimates from a photo are approximate.** Identification is
  reliable; grams are not. Confirm the weight and the result is as good as the
  database entry behind it.
- **Composite dishes are marked `estimate`.** A home biryani and a restaurant
  biryani are not the same food, and the app says so rather than implying a
  precision it does not have.
- **Open Food Facts is crowd-sourced.** Entries are checked against their own
  Atwater arithmetic before use, which catches gross errors but not subtle ones.
- **Your build is a label, not a diagnosis.** Underweight, skinny fat and the
  rest are read from BMI, body fat and fat-free mass index, which is far
  better than BMI alone — but body fat is estimated from a tape or from BMI
  unless you have had it measured properly, and every threshold has people
  either side of it who do not fit.
- **None of this is medical advice.** The safety floors and rate caps are there
  for a reason. If something here disagrees with your doctor, your doctor is
  right.
