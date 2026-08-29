/**
 * Run the schema, for real, before anyone runs it in production.
 *
 * `supabase/schema.sql` had never been executed. It was 282 lines of SQL
 * written from the shape of the app, and the first time it would have run was
 * in someone's live project, where a typo on line 200 leaves half the tables
 * created and half not.
 *
 * PGlite is Postgres compiled to WebAssembly — the real engine, real parser,
 * real constraints — so this applies the schema exactly as Supabase would,
 * then exercises it: inserts a profile, logs a day and a meal, reads the
 * totals view back, and checks that the constraints actually reject bad data.
 *
 * Run: npm run check:schema
 */
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

const sql = await readFile(new URL("../../supabase/schema.sql", import.meta.url), "utf8");
const db = new PGlite();

console.log("\nApplying supabase/schema.sql");

await check("the whole schema applies without error", async () => {
  await db.exec(sql);
});

await check("it is idempotent — running it twice is safe", async () => {
  // Everything is `create ... if not exists`, so a re-run on an existing
  // project must not throw. This is how an upgrade gets applied.
  await db.exec(sql);
});

await check("every table the app writes to exists", async () => {
  const want = [
    "profiles", "diary_entries", "days", "workouts", "workout_sets",
    "progress_photos", "measurements", "custom_foods", "custom_exercises",
    "photo_vault", "coach_notes",
  ];
  const { rows } = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const have = new Set(rows.map((r) => r.table_name));
  for (const t of want) assert.ok(have.has(t), `missing table: ${t}`);
});

await check("row-level security is on for every one of them", async () => {
  const { rows } = await db.query(
    `select relname, relrowsecurity from pg_class
     where relkind = 'r' and relnamespace = 'public'::regnamespace`,
  );
  for (const r of rows) {
    assert.ok(r.relrowsecurity, `${r.relname} has RLS off — it would be readable by the anon key`);
  }
});

console.log("\nExercising it the way the app does");

const UID = "firebase-uid-abc123";

await check("a profile round-trips", async () => {
  await db.query(
    `insert into profiles (uid, display_name, sex, birth_date, height_cm, activity, goal, target_weight_kg, training_days)
     values ($1, 'Niranjan', 'male', '1999-04-12', 178, 'light', 'lose', 75, 4)`,
    [UID],
  );
  const { rows } = await db.query(`select * from profiles where uid = $1`, [UID]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].goal, "lose");
  assert.equal(Number(rows[0].height_cm), 178);
});

await check("a day records a weight", async () => {
  await db.query(
    `insert into days (uid, on_date, weight_kg) values ($1, '2026-08-29', 80.0)`, [UID],
  );
  const { rows } = await db.query(
    `select weight_kg from days where uid = $1 and on_date = '2026-08-29'`, [UID],
  );
  assert.equal(Number(rows[0].weight_kg), 80);
});

await check("diary entries store their frozen nutrition panel", async () => {
  const nutrients = { kcal: 143, protein: 2.4, carbs: 18.2, fat: 6.8, fibre: 1.1 };
  await db.query(
    `insert into diary_entries (uid, on_date, meal, name, grams, source, nutrients, per_100g)
     values ($1, '2026-08-29', 'lunch', 'Roti', 80, 'custom', $2, $3)`,
    [UID, JSON.stringify(nutrients), JSON.stringify(nutrients)],
  );
  const { rows } = await db.query(
    `select nutrients->>'kcal' as kcal from diary_entries where uid = $1`, [UID],
  );
  assert.equal(Number(rows[0].kcal), 143);
});

await check("the daily_totals view adds the day up", async () => {
  await db.query(
    `insert into diary_entries (uid, on_date, meal, name, grams, source, nutrients)
     values ($1, '2026-08-29', 'dinner', 'Dal', 150, 'custom', $2)`,
    [UID, JSON.stringify({ kcal: 174, protein: 10.2, carbs: 27, fat: 2.9, fibre: 6.6 })],
  );
  const { rows } = await db.query(
    `select * from daily_totals where uid = $1 and on_date = '2026-08-29'`, [UID],
  );
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].kcal), 317);          // 143 + 174
  assert.equal(Number(rows[0].protein), 12.6);
  assert.equal(Number(rows[0].entries), 2);
});

await check("a workout keeps its sets, and deleting it takes them with it", async () => {
  const { rows: [w] } = await db.query(
    `insert into workouts (uid, on_date, name) values ($1, '2026-08-29', 'Push A') returning id`,
    [UID],
  );
  for (let i = 1; i <= 3; i++) {
    await db.query(
      `insert into workout_sets (workout_id, uid, exercise_id, exercise_name, set_index, weight_kg, reps, rir)
       values ($1, $2, 'bench', 'Barbell bench press', $3, 60, 8, 2)`,
      [w.id, UID, i],
    );
  }
  let { rows } = await db.query(`select count(*)::int as n from workout_sets where workout_id = $1`, [w.id]);
  assert.equal(rows[0].n, 3);

  // The cascade is what stops orphaned sets accumulating forever.
  await db.query(`delete from workouts where id = $1`, [w.id]);
  ({ rows } = await db.query(`select count(*)::int as n from workout_sets where workout_id = $1`, [w.id]));
  assert.equal(rows[0].n, 0, "sets should have gone with the workout");
});

await check("one measurement per person per day", async () => {
  await db.query(
    `insert into measurements (uid, on_date, waist_cm, neck_cm) values ($1, '2026-08-29', 88, 38)`, [UID],
  );
  await db.query(
    `insert into measurements (uid, on_date, waist_cm) values ($1, '2026-08-29', 87)
     on conflict (uid, on_date) do update set waist_cm = excluded.waist_cm`, [UID],
  );
  const { rows } = await db.query(`select count(*)::int as n from measurements where uid = $1`, [UID]);
  assert.equal(rows[0].n, 1, "the unique constraint should have collapsed these into one");
});

await check("a custom exercise round-trips and cannot be duplicated", async () => {
  await db.query(
    `insert into custom_exercises (uid, name, primary_muscle, equipment, rep_low, rep_high)
     values ($1, 'Band pull-apart', 'shoulders', 'bodyweight', 15, 25)`, [UID],
  );
  const { rows } = await db.query(
    `select name, primary_muscle from custom_exercises where uid = $1`, [UID],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].primary_muscle, "shoulders");
  await assert.rejects(() => db.query(
    `insert into custom_exercises (uid, name, primary_muscle) values ($1, 'Band pull-apart', 'back')`,
    [UID],
  ), "the same name twice for one person should be refused");
});

await check("a photo row outlives the image it points at", async () => {
  await db.query(
    `insert into progress_photos (uid, on_date, pose, path, iv, expires_at, weight_kg)
     values ($1, '2026-01-01', 'front', 'u/x.bin', 'nonce', '2026-07-01', 78.4)`, [UID],
  );
  // What the purge sweep does: drop the bytes, keep the record.
  await db.query(
    `update progress_photos set path = null, iv = null, purged_at = now() where uid = $1`, [UID],
  );
  const { rows } = await db.query(
    `select on_date, weight_kg, path from progress_photos where uid = $1`, [UID],
  );
  assert.equal(rows.length, 1, "the row must survive the purge");
  assert.equal(rows[0].path, null);
  assert.equal(Number(rows[0].weight_kg), 78.4, "the weight is the point of keeping it");
});

await check("retention has to be a sane number of days", async () => {
  await db.query(
    `insert into photo_vault (uid, salt, verifier) values ($1, 'c2FsdA==', 'aXY=.Y2lwaGVy')`, [UID],
  );
  const { rows } = await db.query(`select retention_days from photo_vault where uid = $1`, [UID]);
  assert.equal(rows[0].retention_days, 180, "six months by default");
  await assert.rejects(
    () => db.query(`update photo_vault set retention_days = 2 where uid = $1`, [UID]),
    /retention_days/,
    "two days is not a retention policy",
  );
});

console.log("\nConstraints reject bad data");

/* Assert the *constraint* rejected it, not something else.
 *
 * A bare `assert.rejects` passes when the table does not exist, so these
 * checks were all reporting green while the schema was failing to apply at
 * all — the worst kind of test, one that is loudest when it is least true. */
const rejects = async (label, query, params) => {
  await check(label, async () => {
    let error = null;
    try { await db.query(query, params); } catch (e) { error = e; }
    assert.ok(error, "expected the insert to be rejected, and it was not");
    const message = String(error.message);
    assert.ok(
      /violates check constraint|invalid input|out of range|numeric field overflow/i.test(message),
      `rejected, but for the wrong reason: ${message}`,
    );
  });
};

await rejects("a negative weight",
  `insert into days (uid, on_date, weight_kg) values ($1, '2026-08-30', -5)`, [UID]);

await rejects("a 6000 kcal target",
  `insert into profiles (uid, kcal_override) values ('other-uid', 60000)`, []);

await rejects("an impossible portion",
  `insert into diary_entries (uid, on_date, meal, name, grams, source, nutrients)
   values ($1, '2026-08-30', 'lunch', 'Rice', 99999, 'custom', '{}')`, [UID]);

await rejects("a meal that is not a meal",
  `insert into diary_entries (uid, on_date, meal, name, grams, source, nutrients)
   values ($1, '2026-08-30', 'brunch', 'Eggs', 100, 'custom', '{}')`, [UID]);

await rejects("a body fat percentage of 90",
  `insert into measurements (uid, on_date, body_fat_pct) values ($1, '2026-08-31', 90)`, [UID]);

await db.close();
console.log(`\n${passed} schema checks passed.\n`);
