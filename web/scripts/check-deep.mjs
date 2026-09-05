/**
 * The paths check-live cannot reach.
 *
 * check-live drives the CRUD routes, which is most of the app and none of
 * the parts that were hardest to get right. This one exercises the AI, the
 * photo vault's actual cryptography, the retention endpoint's refusal, and
 * a barcode against the live Open Food Facts index.
 *
 * The vault test is the one worth reading. It encrypts a real JPEG, uploads
 * it, pulls it back through the signed URL, and asserts two things: that the
 * stored bytes are NOT the original, and that they decrypt to it exactly.
 * The first assertion is the promise the app makes to the person in the
 * photograph, and without it the second would pass on plaintext.
 *
 *   npm run check:deep
 */
import fs from "node:fs";
import { webcrypto as wc } from "node:crypto";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n")
  .filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));

const APP = process.env.APP ?? "https://macrofitness.vercel.app";
const fail = [];
const bad = (w, m) => { fail.push(w); console.log(`  FAIL  ${w}: ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);

const su = await (await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
  { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `deep-${Date.now()}@example.com`, password: "Deep-Throwaway-88x", returnSecureToken: true }) },
)).json();
const s = await fetch(`${APP}/api/auth/session`, { method: "POST",
  headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken: su.idToken }) });
const H = { cookie: (s.headers.getSetCookie() || []).map((c) => c.split(";")[0]).join("; "),
            "content-type": "application/json" };

const today = new Date().toISOString().slice(0, 10);
await fetch(`${APP}/api/profile`, { method: "PUT", headers: H, body: JSON.stringify({
  birth_date: "1998-04-12", sex: "male", height_cm: 175, activity: "moderate",
  goal: "lose", target_weight_kg: 70, training_days: 4, timezone: "Asia/Kolkata" }) });
await fetch(`${APP}/api/day`, { method: "PUT", headers: H, body: JSON.stringify({ date: today, weight_kg: 82.4 }) });

console.log("\nAI");
let r = await fetch(`${APP}/api/food/estimate`, { method: "POST", headers: H,
  body: JSON.stringify({ dish: "sambar", description: "toor dal, drumstick, tamarind, 2 tbsp oil, serves 4" }) });
let b = await r.json().catch(() => ({}));
if (r.status !== 200 || b.error) bad("estimate", `${r.status} ${JSON.stringify(b).slice(0, 140)}`);
else if (!(b.per100g?.kcal > 40 && b.per100g.kcal < 160))
  bad("estimate", `sambar at ${b.per100g?.kcal} kcal/100g is not plausible`);
else ok(`estimate: sambar ${b.per100g.kcal} kcal/100g from ${b.ingredients.length} ingredients`);

r = await fetch(`${APP}/api/chat`, { method: "POST", headers: H,
  body: JSON.stringify({ messages: [{ role: "user", content: "How much protein should I eat today?" }] }) });
b = await r.json().catch(() => ({}));
if (r.status !== 200) bad("chat", `${r.status} ${(b.error ?? "").slice(0, 120)}`);
else if (!b.text) bad("chat", "answered with an empty reply");
else ok(`chat: "${b.text.slice(0, 70)}..."`);

r = await fetch(`${APP}/api/coach`, { headers: H });
if (r.status !== 200) bad("coach", `${r.status}`); else ok("weekly review answers");

console.log("\nPhoto vault — real encrypt / upload / download / decrypt");
const b64 = (x) => Buffer.from(x).toString("base64");
const salt = wc.getRandomValues(new Uint8Array(16));
const base = await wc.subtle.importKey("raw", new TextEncoder().encode("a-real-passphrase"), "PBKDF2", false, ["deriveKey"]);
const key = await wc.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
  base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
const vIv = wc.getRandomValues(new Uint8Array(12));
const vC = await wc.subtle.encrypt({ name: "AES-GCM", iv: vIv }, key, new TextEncoder().encode("macro/photo-vault/v1"));
r = await fetch(`${APP}/api/progress/vault`, { method: "POST", headers: H,
  body: JSON.stringify({ salt: b64(salt), verifier: `${b64(vIv)}.${b64(vC)}`, retentionDays: 180 }) });
if (r.status !== 200) bad("vault setup", `${r.status}`); else ok("vault created");

let photoId = null;
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
const pIv = wc.getRandomValues(new Uint8Array(12));
const pC = Buffer.from(await wc.subtle.encrypt({ name: "AES-GCM", iv: pIv }, key, jpeg));
r = await fetch(`${APP}/api/progress/photos`, { method: "POST", headers: H,
  body: JSON.stringify({ cipher: pC.toString("base64"), iv: b64(pIv), pose: "front", date: today }) });
b = await r.json().catch(() => ({}));
if (r.status !== 200) bad("photo upload", `${r.status} ${JSON.stringify(b).slice(0, 140)}`);
else {
  ok(`photo stored, expires ${b.photo?.expires_at}`);
  photoId = b.photo.id;
  const raw = Buffer.from(await (await fetch(b.photo.url)).arrayBuffer());
  if (raw.equals(jpeg)) bad("ENCRYPTION", "the stored bytes ARE the original image — it was not encrypted");
  else ok("what is stored is not the original image");
  try {
    const plain = Buffer.from(await wc.subtle.decrypt({ name: "AES-GCM", iv: pIv }, key, raw));
    if (plain.equals(jpeg)) ok("decrypts back to the exact original");
    else bad("decrypt", "decrypted bytes differ from the original");
  } catch (e) { bad("decrypt", e.message); }
}

console.log("\nRetention");
r = await fetch(`${APP}/api/progress/purge`);
if (r.status !== 401) bad("purge auth", `an unauthenticated call returned ${r.status}, expected 401`);
else ok("the purge endpoint refuses an unauthenticated caller");

r = await fetch(`${APP}/api/progress/purge`, { headers: { authorization: "Bearer definitely-not-the-secret" } });
if (r.status !== 401) bad("purge auth", `a wrong secret returned ${r.status}, expected 401`);
else ok("and refuses a wrong secret");

/* The sweep itself, for real: age the photo just uploaded past its expiry,
   run the cron, and check both halves of the promise — that the bytes are
   gone from storage, and that the row survives carrying the date and weight
   the progress chart is drawn from. Testing only the first half would pass
   on a sweep that deleted everything. */
if (env.CRON_SECRET && env.SUPABASE_SERVICE_ROLE_KEY && photoId) {
  const db = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
    Prefer: "return=representation",
  };
  const U = env.NEXT_PUBLIC_SUPABASE_URL;
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await fetch(`${U}/rest/v1/progress_photos?id=eq.${photoId}`,
    { method: "PATCH", headers: db, body: JSON.stringify({ expires_at: yesterday }) });

  const swept = await (await fetch(`${APP}/api/progress/purge`,
    { headers: { authorization: `Bearer ${env.CRON_SECRET}` } })).json();
  if (!(swept.purged > 0)) bad("purge", `the sweep reported ${JSON.stringify(swept)}`);
  else ok(`the sweep ran and purged ${swept.purged}`);

  const [row] = await (await fetch(
    `${U}/rest/v1/progress_photos?id=eq.${photoId}&select=path,iv,purged_at,weight_kg,on_date`,
    { headers: db })).json();
  if (!row) bad("purge", "the row was deleted, not purged — the chart data is gone");
  else if (row.path !== null || row.iv !== null) bad("purge", "the bytes were not released");
  else if (row.purged_at === null) bad("purge", "the row was not marked purged");
  else if (row.weight_kg === null || row.on_date === null) bad("purge", "the row lost the data worth keeping");
  else ok(`bytes released, row survives with ${row.weight_kg} kg on ${row.on_date}`);
} else {
  console.log("  note  CRON_SECRET not in .env.local, so the sweep itself is untested");
}

console.log("\nBarcode");

r = await fetch(`${APP}/api/food/barcode/8901262010320`, { headers: H });
b = await r.json().catch(() => ({}));
if (r.status !== 200 || !b.food?.name) bad("barcode", `${r.status} ${JSON.stringify(b).slice(0, 100)}`);
else ok(`barcode: ${b.food.name}`);

try {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  const auth = getAuth();
  let n = 0;
  for (const u of (await auth.listUsers(1000)).users) {
    if (/^deep-\d+@example\.com$/.test(u.email ?? "")) { await auth.deleteUser(u.uid); n++; }
  }
  ok(`cleaned up ${n} throwaway account(s)`);
} catch { console.log("  note  could not clean up the throwaway accounts"); }

console.log(fail.length ? `\n${fail.length} FAILURE(S): ${fail.join(", ")}\n` : "\nAll deep checks passed.\n");
process.exit(fail.length ? 1 : 0);
