/**
 * Drive every route against a real deployment, as a real signed-in person.
 *
 * The unit suites check the arithmetic and the schema suite checks the
 * tables. Neither catches a route that validates the wrong field, or a
 * feature that is half-wired — you can create a custom exercise and then
 * cannot log a set against it, and every test still passes. This is the
 * suite that would have caught that.
 *
 *   npm run check:live                       (against production)
 *   APP=http://localhost:3000 npm run check:live
 *
 * It signs up throwaway accounts and deletes them at the end.
 */
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n")
  .filter(l=>l&&!l.startsWith("#")&&l.includes("="))
  .map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const APP = process.env.APP ?? "https://macrofitness.vercel.app";
const KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;

const bugs = [];
const bug = (where, what) => { bugs.push({where,what}); console.log(`  BUG   ${where}: ${what}`); };
const ok  = (m) => console.log(`  ok    ${m}`);

const email = `e2e-${Date.now()}@example.com`;
const su = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
  {method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({email,password:"E2e-Throwaway-Pass-88",returnSecureToken:true})})).json();
const s = await fetch(`${APP}/api/auth/session`,{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify({idToken:su.idToken})});
const cookie = (s.headers.getSetCookie?.()||[]).map(c=>c.split(";")[0]).join("; ");
const H = {cookie,"content-type":"application/json"};
const J = async (p,init={}) => {
  const r = await fetch(`${APP}${p}`,{...init,headers:{...H,...(init.headers||{})}});
  let b=null; try{b=await r.json();}catch{}
  return {status:r.status, body:b};
};
ok(`signed in as a fresh account`);

const today = new Date().toISOString().slice(0,10);

// ---- profile -------------------------------------------------------
let r = await J("/api/profile",{method:"PUT",body:JSON.stringify({
  birth_date:"1998-04-12", sex:"male", height_cm:175, activity_level:"moderate",
  goal:"lose", target_weight_kg:70, training_days:4 })});
if (r.status!==200) bug("PUT /api/profile", `${r.status} ${JSON.stringify(r.body)}`); else ok("profile saves");

// ---- weight --------------------------------------------------------
r = await J("/api/day",{method:"PUT",body:JSON.stringify({date:today, weight_kg:82.4})});
if (r.status!==200) bug("PUT /api/day", `${r.status} ${JSON.stringify(r.body)}`); else ok("weight logs");

// ---- targets ------------------------------------------------------
// On /api/day, not /api/plan — /api/plan is the training session.
r = await J(`/api/day?date=${today}`);
const t = r.body?.targets;
if (!t) bug("GET /api/day","no targets after a full profile");
else {
  ok(`targets: ${t.kcal} kcal, P${t.protein} C${t.carbs} F${t.fat}`);
  const fromMacros = t.protein*4 + t.carbs*4 + t.fat*9;
  if (Math.abs(fromMacros - t.kcal) > t.kcal*0.05)
    bug("GET /api/day", `macros sum to ${Math.round(fromMacros)} kcal but the target says ${t.kcal}`);
  else ok("the macro split adds up to the calorie target");
  if (t.protein < 100) bug("GET /api/day", `protein ${t.protein}g is low for an 82kg person losing weight`);
}

// ---- food search ---------------------------------------------------
r = await J("/api/food/search?q=rice");
if (!r.body?.foods?.length) bug("GET /api/food/search","'rice' returns nothing");
else ok(`search works (${r.body.foods.length} for rice)`);

r = await J("/api/food/search?q=");
if (r.status>=500) bug("GET /api/food/search","empty query 500s");
else ok(`empty query handled (${r.status}, ${r.body?.foods?.length??0} results)`);

r = await J("/api/food/search?q=" + encodeURIComponent("'; drop table diary_entries; --"));
if (r.status>=500) bug("GET /api/food/search","a quote in the query 500s");
else ok("odd characters in a search do not break it");

// ---- diary ---------------------------------------------------------
const food = (await J("/api/food/search?q=rice")).body.foods[0];
r = await J("/api/diary",{method:"POST",body:JSON.stringify({
  date:today, grams:200, source:food.source, source_id:food.id, name:food.name, per_100g:food.per100g})});
if (r.status!==200) bug("POST /api/diary", `${r.status} ${JSON.stringify(r.body)}`);
else {
  const e = r.body.entry;
  const expect = Math.round(food.per100g.kcal*2);
  const got = Math.round(e.nutrients?.kcal ?? e.kcal ?? 0);
  if (Math.abs(got-expect) > 2) bug("POST /api/diary", `200g of ${food.name} logged ${got} kcal, expected ~${expect}`);
  else ok(`200 g logged as ${got} kcal (per-100g ${food.per100g.kcal})`);
}

r = await J(`/api/diary?date=${today}`);
if (!r.body?.entries?.length) bug("GET /api/diary","the entry just written does not read back");
else ok(`diary reads back (${r.body.entries.length} entry)`);

// negative and absurd grams
for (const [g,label] of [[-100,"negative"],[999999,"absurd"]]) {
  r = await J("/api/diary",{method:"POST",body:JSON.stringify({
    date:today, grams:g, source:food.source, source_id:food.id, name:food.name, per_100g:food.per100g})});
  if (r.status===200) bug("POST /api/diary",`${label} grams (${g}) was accepted`);
  else ok(`${label} grams refused (${r.status})`);
}

// ---- workouts ------------------------------------------------------
r = await J("/api/workouts",{method:"POST",body:JSON.stringify({date:today,name:"Push",split:"push_pull_legs"})});
const w = r.body?.workout;
if (!w) bug("POST /api/workouts", `${r.status} ${JSON.stringify(r.body)}`);
else {
  ok("workout created");
  r = await J(`/api/workouts/${w.id}/sets`,{method:"POST",body:JSON.stringify({
    exercise_id:"bench", weight_kg:60, reps:8, rir:2})});
  if (r.status!==200) bug("POST sets", `${r.status} ${JSON.stringify(r.body)}`); else ok("a set logs");

  r = await J(`/api/workouts/${w.id}/sets`,{method:"POST",body:JSON.stringify({
    exercise_id:"bench", weight_kg:-60, reps:8})});
  if (r.status===200) bug("POST sets","a negative weight was accepted"); else ok("negative weight refused");

  r = await J("/api/workouts");
  const back = r.body?.workouts?.find(x=>x.id===w.id);
  if (!back) bug("GET /api/workouts","the workout does not read back");
  else if (back.totalSets !== 1) bug("GET /api/workouts",`totalSets is ${back.totalSets}, expected 1`);
  else ok(`workout reads back with volume ${back.volumeKg} kg, e1RM ${back.bestE1rm}`);
}

// ---- custom exercises ----------------------------------------------
r = await J("/api/exercises",{method:"POST",body:JSON.stringify({
  name:"Sled push", primary:"quads", equipment:"machine", repLow:20, repHigh:10})});
if (r.status!==200) bug("POST /api/exercises", `${r.status} ${JSON.stringify(r.body)}`);
else if (r.body.exercise.repRange[0] > r.body.exercise.repRange[1])
  bug("POST /api/exercises", `an inverted rep range came back as ${r.body.exercise.repRange}`);
else ok(`inverted rep range corrected to ${r.body.exercise.repRange}`);

r = await J("/api/exercises",{method:"POST",body:JSON.stringify({name:"Bad", primary:"elbow"})});
if (r.status===200) bug("POST /api/exercises","'elbow' was accepted as a muscle"); else ok("a bogus muscle is refused");

// ---- a custom exercise must be loggable, not just creatable ---------
const mine = (await J("/api/exercises",{method:"POST",body:JSON.stringify({
  name:"Band pull-apart", primary:"shoulders", repLow:15, repHigh:25})})).body?.exercise;
if (!mine) bug("POST /api/exercises","could not create one to test with");
else if (!w) bug("custom exercise","no workout to log against");
else {
  r = await J(`/api/workouts/${w.id}/sets`,{method:"POST",body:JSON.stringify({
    exercise_id:mine.id, weight_kg:10, reps:20})});
  if (r.status!==200) bug("POST sets", `a custom exercise cannot be logged: ${r.status} ${JSON.stringify(r.body)}`);
  else ok("a custom exercise can be logged against");
}

// ---- an AI estimate must not be labelled as a packet panel ----------
r = await J("/api/diary",{method:"POST",body:JSON.stringify({
  date:today, name:"Amma's sambar", grams:200, source:"estimate",
  per_100g:{kcal:85,protein:4,carbs:10,fat:3,fibre:2,sugar:0,satFat:0,sodium:0}})});
if (r.status!==200) bug("POST /api/diary", `an estimate was refused: ${JSON.stringify(r.body)}`);
else {
  const e = r.body.entry;
  if (e.source !== "estimate") bug("POST /api/diary", `an estimate was stored with source "${e.source}"`);
  else if (e.confidence === "label") bug("POST /api/diary", "an AI estimate is labelled 'From the packet'");
  else ok(`an estimate keeps its provenance (source ${e.source}, confidence ${e.confidence})`);
}

// ---- measurements ---------------------------------------------------
r = await J("/api/progress/measurements",{method:"POST",body:JSON.stringify({
  date:today, neck_cm:38, waist_cm:92, chest_cm:102})});
if (r.status!==200) bug("POST measurements", `${r.status} ${JSON.stringify(r.body)}`);
else if (r.body.measurement?.body_fat_pct == null) bug("POST measurements","navy body fat was not derived from neck+waist+height");
else ok(`body fat derived: ${r.body.measurement.body_fat_pct}%`);

// ---- coach / day ----------------------------------------------------
for (const p of ["/api/coach","/api/day?date="+today,"/api/progress/photos","/api/progress/vault","/api/exercises"]) {
  r = await J(p);
  if (r.status>=500) bug(`GET ${p}`, `${r.status} ${JSON.stringify(r.body).slice(0,120)}`);
  else ok(`GET ${p} -> ${r.status}`);
}

// ---- cross-account isolation ----------------------------------------
const su2 = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${KEY}`,
  {method:"POST",headers:{"content-type":"application/json"},
   body:JSON.stringify({email:`e2e-b-${Date.now()}@example.com`,password:"E2e-Throwaway-Pass-88",returnSecureToken:true})})).json();
const s2 = await fetch(`${APP}/api/auth/session`,{method:"POST",
  headers:{"content-type":"application/json"},body:JSON.stringify({idToken:su2.idToken})});
const cookie2 = (s2.headers.getSetCookie?.()||[]).map(c=>c.split(";")[0]).join("; ");

const other = await (await fetch(`${APP}/api/diary?date=${today}`,{headers:{cookie:cookie2}})).json();
if (other.entries?.length) bug("GET /api/diary","a second account can see the first account's food");
else ok("a second account sees none of the first account's diary");

const steal = await fetch(`${APP}/api/workouts/${w?.id}/sets`,{method:"POST",
  headers:{cookie:cookie2,"content-type":"application/json"},
  body:JSON.stringify({exercise_id:"bench",weight_kg:100,reps:5})});
if (steal.status===200) bug("POST sets","a second account can add sets to someone else's workout");
else ok(`writing to another account's workout refused (${steal.status})`);

// ---- tidy up the throwaway accounts ---------------------------------
try {
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT.replace(/^"|"$/g, ""))) });
  const auth = getAuth();
  let removed = 0;
  for (const u of (await auth.listUsers(1000)).users) {
    if (/^e2e(-b)?-\d+@example\.com$/.test(u.email ?? "")) { await auth.deleteUser(u.uid); removed++; }
  }
  ok(`cleaned up ${removed} throwaway account(s)`);
} catch {
  console.log("  note  could not clean up the throwaway accounts");
}

console.log(bugs.length ? `\n${bugs.length} BUG(S)\n` : "\nNo bugs found.\n");
process.exit(bugs.length ? 1 : 0);
