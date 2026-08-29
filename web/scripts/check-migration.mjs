/**
 * Prove the migration does what it claims against a database shaped like the
 * live one — that is, built from schema.sql as it was before today.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";

const R = new URL("../..", import.meta.url).pathname;
const old = execSync(`cd ${R} && git show HEAD:supabase/schema.sql`).toString();
const migration = readFileSync(`${R}/supabase/migrations/001_photo_vault.sql`, "utf8");

const db = new PGlite();
await db.exec(old);
console.log("  ok   yesterday's schema applies");

await db.query(
  `insert into progress_photos (uid, on_date, pose, path, weight_kg)
   values ('u1', '2026-01-01', 'front', 'u1/old.jpg', 80)`);

await db.exec(migration);
console.log("  ok   the migration applies to it");
await db.exec(migration);
console.log("  ok   and applies twice");

const { rows } = await db.query(
  `select iv, expires_at, purged_at, path from progress_photos where uid = 'u1'`);
assert.equal(rows[0].iv, null);
assert.equal(rows[0].path, "u1/old.jpg");
assert.ok(rows[0].expires_at, "an existing photo must be given an expiry");
assert.equal(new Date(rows[0].expires_at).toISOString().slice(0, 10), "2026-06-30");
console.log("  ok   photos uploaded before the vault get six months, not forever");

await db.query(`update progress_photos set path = null, iv = null, purged_at = now()`);
const after = await db.query(`select weight_kg from progress_photos where uid = 'u1'`);
assert.equal(Number(after.rows[0].weight_kg), 80);
console.log("  ok   purging the bytes leaves the weight behind");

for (const t of ["photo_vault", "custom_exercises"]) {
  const { rows: [r] } = await db.query(
    `select relrowsecurity from pg_class where relname = $1`, [t]);
  assert.equal(r.relrowsecurity, true, `${t} must have RLS on`);
}
console.log("  ok   both new tables are closed to the anon key");

await db.close();
console.log("\n7 migration checks passed.");
