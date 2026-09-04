"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Portion } from "@/components/Portion";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Search, Loader2, Check, ArrowLeft, Info, ScanLine, Sparkles } from "lucide-react";
import { get, post, today } from "@/lib/client";
import { isNative, nativePhoto, tapFeedback } from "@/lib/native";

export default function FoodPage() {
  return (
    <Suspense fallback={null}>
      <FoodLogger />
    </Suspense>
  );
}

/**
 * Logging food.
 *
 * Three ways in, and the photo is first because it is the one that gets used
 * when someone is halfway through eating. But nothing goes into the diary
 * straight from a photo: the model's portion estimate is shown as an editable
 * number, and the person confirms it. A guess that is silently written to
 * history stops being a guess and starts being a false record.
 */
function FoodLogger() {
  const router = useRouter();
  const date = useSearchParams().get("date") ?? today();

  const [tab, setTab] = useState("photo");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(0);

  return (
    <div className="space-y-4 py-6">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          aria-label="Back"
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-slab-2)]"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="display text-3xl">Add food</h1>
        {saved > 0 && (
          <span className="chip ml-auto" style={{ color: "var(--color-volt)" }}>
            <Check size={12} /> {saved} logged
          </span>
        )}
      </header>

      <div className="flex gap-1 rounded-xl bg-[var(--color-slab-2)] p-1">
        {[
          ["photo", "Photo", Camera],
          ["search", "Search", Search],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              setError("");
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold"
            style={{
              background: tab === k ? "var(--color-volt)" : "transparent",
              color: tab === k ? "#000" : "var(--color-mute)",
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="card p-4 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {tab === "photo" && (
        <PhotoTab date={date} onError={setError} onSaved={() => setSaved((n) => n + 1)} />
      )}
      {tab === "search" && (
        <SearchTab date={date} onError={setError} onSaved={() => setSaved((n) => n + 1)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo — shoot it, or say what it was                                */
/* ------------------------------------------------------------------ */

/**
 * One tab, two ways in, the same estimate at the end.
 *
 * These used to be separate tabs, and separating them was wrong: the reason
 * you photograph a meal and the reason you describe one are the same reason —
 * you do not have a packet to copy the numbers off. A photo answers it when
 * the food is in front of you; a description answers it when it is not, or
 * when the camera got it wrong. Either way the calories come from the
 * database, not from the model.
 */
function PhotoTab({ date, onError, onSaved }) {
  const fileRef = useRef(null);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function run(dataUrl) {
    setImage(dataUrl);
    setResult(null);
    setBusy(true);
    onError("");
    try {
      setResult(await post("/api/food/identify", { image: dataUrl }));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    // Native camera in the shell; the file input everywhere else.
    if (isNative()) {
      const photo = await nativePhoto();
      if (photo) run(photo);
    } else {
      fileRef.current?.click();
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) run(await downscale(file));
          e.target.value = "";
        }}
      />

      {!image && (
        <button
          onClick={capture}
          className="card grid w-full place-items-center gap-3 p-10 text-center"
        >
          <Camera size={34} className="text-[var(--color-volt)]" />
          <span className="font-semibold">Photograph your meal</span>
          <span className="max-w-xs text-xs leading-relaxed text-[var(--color-mute)]">
            Macro identifies each food and estimates the weight. The calories come from a nutrition
            database, not from the model — so check the grams and they will be right. No camera to
            hand? Describe it below instead.
          </span>
        </button>
      )}

      {image && (
        /* eslint-disable-next-line @next/next/no-img-element -- a local data URL, never a remote asset */
        <img src={image} alt="Your meal" className="w-full rounded-[var(--radius-card)]" />
      )}

      {busy && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--color-mute)]">
          <Loader2 className="animate-spin" size={16} /> Reading the photo…
        </p>
      )}

      {result?.notFood && (
        <p className="card p-4 text-sm text-[var(--color-mute)]">
          No food in that one. Try again with the plate in frame.
        </p>
      )}

      {result?.items.map((item, i) => (
        <IdentifiedCard key={i} item={item} date={date} onError={onError} onSaved={onSaved} />
      ))}

      {image && !busy && (
        <button
          onClick={() => {
            setImage(null);
            setResult(null);
          }}
          className="btn btn-ghost w-full"
        >
          Take another
        </button>
      )}

      <div className="flex items-center gap-3 pt-2">
        <span className="h-px flex-1 bg-[var(--color-line)]" />
        <span className="label mb-0">or say what it was</span>
        <span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <Describe date={date} onError={onError} onSaved={onSaved} />
    </div>
  );
}

/**
 * One identified food, with the weight editable before it is logged.
 *
 * Nutrition recalculates locally as the grams are changed so the number
 * responds immediately, but the entry is still scaled server-side from the
 * per-100 g panel when it is saved — the client's arithmetic is for feedback,
 * never for the record.
 */
function IdentifiedCard({ item, date, onError, onSaved }) {
  const [grams, setGrams] = useState(item.grams);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const per100 = item.food?.per100g ?? null;
  const shown = per100 ? scale(per100, grams) : item.nutrients;

  if (!item.food) {
    return (
      <div className="card p-4">
        <p className="font-semibold">{item.label}</p>
        <p className="mt-1 text-sm text-[var(--color-mute)]">
          Recognised, but not in any nutrition database. Add it by hand and it will be there next
          time.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4" style={{ opacity: done ? 0.55 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{item.label}</p>
          <p className="truncate text-xs text-[var(--color-mute)]">
            {item.food.name}
            {item.food.brand && ` · ${item.food.brand}`}
          </p>
        </div>
        <Provenance food={item.food} confidence={item.confidence} />
      </div>

      {item.portion?.count > 0 && (
        <p className="mt-1 text-[11px] text-[var(--color-mute)]">
          Looks like about{" "}
          <span className="num text-[var(--color-chalk)]">
            {item.portion.count === 0.5 ? "\u00bd" : item.portion.count === 1.5 ? "1\u00bd" : item.portion.count}
          </span>{" "}
          {item.portion.measure.toLowerCase()}
          {item.portion.count > 1 && !/s$/.test(item.portion.measure) ? "s" : ""} — correct it below if not.
        </p>
      )}

      {item.note && (
        <p className="mt-2 flex gap-1.5 text-xs text-[var(--color-warn)]">
          <Info size={13} className="mt-px shrink-0" /> {item.note}
        </p>
      )}

      <div className="mt-3">
        <Portion
          food={item.food}
          grams={grams}
          onGrams={setGrams}
          label={`Grams of ${item.label}`}
        />
      </div>

      {shown && (
        <dl className="num mt-3 grid grid-cols-5 gap-1 border-t border-[var(--color-line)] pt-3 text-center text-xs">
          {[
            ["kcal", shown.kcal],
            ["P", shown.protein],
            ["C", shown.carbs],
            ["F", shown.fat],
            ["Fib", shown.fibre],
          ].map(([l, v]) => (
            <div key={l}>
              <dd className="font-bold">{Math.round(v)}</dd>
              <dt className="text-[10px] text-[var(--color-mute)]">{l}</dt>
            </div>
          ))}
        </dl>
      )}

      <button
        disabled={done || busy || grams <= 0}
        onClick={async () => {
          setBusy(true);
          try {
            await post("/api/diary", {
              date,
              grams,
              source: item.food.source,
              source_id: item.food.id,
              name: item.label,
              // Carried for standalone mode, which has no server to re-fetch
              // with. With a backend the id wins and this is ignored.
              per_100g: item.food.per100g,
            });
            await tapFeedback();
            setDone(true);
            onSaved();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Could not log that.");
          } finally {
            setBusy(false);
          }
        }}
        className="btn btn-primary mt-3 w-full"
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : done ? <Check size={16} /> : null}
        {done ? "Logged" : "Log it"}
      </button>
    </div>
  );
}

/** Where a number came from, said plainly. */
function Provenance({ food, confidence }) {
  const label =
    food.confidence === "label"
      ? "From the packet"
      : food.confidence === "measured"
        ? "Lab measured"
        : "Estimate";
  const colour =
    food.confidence === "measured"
      ? "var(--color-fibre)"
      : food.confidence === "label"
        ? "var(--color-protein)"
        : "var(--color-mute)";

  return (
    <span className="shrink-0 text-right">
      <span className="chip" style={{ color: colour, borderColor: colour }}>
        {label}
      </span>
      {confidence === "low" && (
        <span className="mt-1 block text-[10px] text-[var(--color-warn)]">check this one</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Search and barcode                                                  */
/* ------------------------------------------------------------------ */

function SearchTab({ date, onError, onSaved }) {
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState([]);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(null);

  // Debounced: searching on every keystroke would hammer two public APIs.
  // Every setState here is inside the timeout callback rather than the effect
  // body, so no render cascades off the keystroke itself.
  useEffect(() => {
    const t = setTimeout(
      async () => {
        if (q.trim().length < 2) {
          setFoods([]);
          return;
        }
        setBusy(true);
        try {
          const digits = q.replace(/\D/g, "");
          // A long run of digits is a barcode, not a search term.
          if (digits.length >= 8 && digits.length === q.trim().length) {
            const { food } = await get(`/api/food/barcode/${digits}`);
            setFoods([food]);
          } else {
            setFoods((await get(`/api/food/search?q=${encodeURIComponent(q)}`)).foods);
          }
        } catch (e) {
          onError(e instanceof Error ? e.message : "Search failed.");
          setFoods([]);
        } finally {
          setBusy(false);
        }
      },
      q.trim().length < 2 ? 0 : 350,
    );
    return () => clearTimeout(t);
  }, [q, onError]);

  if (chosen) {
    return (
      <PortionPicker
        food={chosen}
        date={date}
        onError={onError}
        onSaved={() => {
          onSaved();
          setChosen(null);
          setQ("");
        }}
        onBack={() => setChosen(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)]"
        />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="field pl-10"
          placeholder="Dal, chicken breast, or a barcode"
          aria-label="Search for a food"
        />
        {busy && (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-mute)]"
          />
        )}
      </div>

      <p className="flex gap-1.5 px-1 text-xs text-[var(--color-mute)]">
        <ScanLine size={13} className="mt-px shrink-0" />
        Type the numbers under a barcode for the manufacturer&apos;s own panel — the most accurate
        entry there is.
      </p>

      <ul className="space-y-2">
        {foods.map((f) => (
          <li key={`${f.source}-${f.id}`}>
            <button
              onClick={() => setChosen(f)}
              className="card flex w-full items-center gap-3 p-3.5 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="num truncate text-xs text-[var(--color-mute)]">
                  {f.brand && `${f.brand} · `}
                  {Math.round(f.per100g.kcal)} kcal / 100 g
                </p>
              </div>
              <Provenance food={f} />
            </button>
          </li>
        ))}
      </ul>

      {!busy && q.trim().length >= 2 && !foods.length && (
        <p className="card p-6 text-center text-sm text-[var(--color-mute)]">
          Nothing found. Try a simpler name — &ldquo;dal&rdquo; rather than &ldquo;mum&rsquo;s
          dal&rdquo; — or add it by hand.
        </p>
      )}
    </div>
  );
}

function PortionPicker({ food, date, onError, onSaved, onBack }) {
  const [grams, setGrams] = useState(food.servingG ?? 100);
  const [meal, setMeal] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = scale(food.per100g, grams);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--color-mute)]"
      >
        <ArrowLeft size={15} /> Back to results
      </button>

      <div className="card p-4">
        <p className="font-semibold">{food.name}</p>
        {food.brand && <p className="text-xs text-[var(--color-mute)]">{food.brand}</p>}
        <div className="mt-3">
          <Provenance food={food} />
        </div>

        <div className="mt-4">
          <Portion food={food} grams={grams} onGrams={setGrams} label={`Grams of ${food.name}`} />
        </div>

        <dl className="num mt-4 grid grid-cols-5 gap-1 border-t border-[var(--color-line)] pt-3 text-center text-sm">
          {[
            ["kcal", shown.kcal],
            ["P", shown.protein],
            ["C", shown.carbs],
            ["F", shown.fat],
            ["Fib", shown.fibre],
          ].map(([l, v]) => (
            <div key={l}>
              <dd className="font-bold">{Math.round(v)}</dd>
              <dt className="text-[10px] text-[var(--color-mute)]">{l}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex gap-1.5">
        {["breakfast", "lunch", "dinner", "snack"].map((m) => (
          <button
            key={m}
            onClick={() => setMeal(meal === m ? "" : m)}
            className="flex-1 rounded-lg border py-2 text-xs font-semibold capitalize"
            style={{
              borderColor: meal === m ? "var(--color-volt)" : "var(--color-line)",
              color: meal === m ? "var(--color-volt)" : "var(--color-mute)",
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <button
        disabled={busy || grams <= 0}
        className="btn btn-primary w-full"
        onClick={async () => {
          setBusy(true);
          try {
            await post("/api/diary", {
              date,
              grams,
              source: food.source,
              source_id: food.id,
              name: food.name,
              brand: food.brand,
              confidence: food.confidence,
              per_100g: food.per100g,
              ...(meal ? { meal } : {}),
            });
            await tapFeedback();
            onSaved();
          } catch (e) {
            onError(e instanceof Error ? e.message : "Could not log that.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
        Log {Math.round(shown.kcal)} kcal
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Describing a meal instead of photographing it                       */
/* ------------------------------------------------------------------ */

function Describe({ date, onError, onSaved }) {
  const [name, setName] = useState("");
  const [what, setWhat] = useState("");
  const [grams, setGrams] = useState("100");
  const [per, setPer] = useState({ kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [estimate, setEstimate] = useState(null);

  /* Estimating is the point of this tab. A packet has a panel to copy; your
     mother's sambar does not, and asking someone to invent one is how a food
     diary quietly becomes fiction. */
  async function guess() {
    if (!name.trim() || thinking) return;
    setThinking(true);
    onError("");
    setEstimate(null);
    try {
      const res = await post("/api/food/estimate", {
        dish: name,
        description: what,
      });
      if (res.error) {
        onError(res.error);
        return;
      }
      setEstimate(res);
      setPer({
        kcal: String(res.per100g.kcal),
        protein: String(res.per100g.protein),
        carbs: String(res.per100g.carbs),
        fat: String(res.per100g.fat),
        fibre: String(res.per100g.fibre),
      });
      if (res.serves > 0 && res.totalGrams > 0) {
        setGrams(String(Math.round(res.totalGrams / res.serves)));
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not estimate that.");
    } finally {
      setThinking(false);
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await post("/api/diary", {
            date,
            name,
            grams: Number(grams),
            source: estimate ? "estimate" : "custom",
            confidence: "estimated",
            per_100g: {
              kcal: Number(per.kcal) || 0,
              protein: Number(per.protein) || 0,
              carbs: Number(per.carbs) || 0,
              fat: Number(per.fat) || 0,
              fibre: Number(per.fibre) || 0,
              sugar: 0,
              satFat: 0,
              sodium: 0,
            },
          });
          await tapFeedback();
          onSaved();
          setName("");
          setWhat("");
          setEstimate(null);
          setPer({ kcal: "", protein: "", carbs: "", fat: "", fibre: "" });
        } catch (e2) {
          onError(e2 instanceof Error ? e2.message : "Could not save that.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="fname">
          What is it?
        </label>
        <input
          id="fname"
          required
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Amma's sambar"
        />
      </div>

      <div>
        <label className="label" htmlFor="what">
          What went into it? (optional)
        </label>
        <textarea
          id="what"
          rows={2}
          className="field py-2.5"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          placeholder="Toor dal, drumstick, tamarind, 2 tbsp oil, serves 4"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-mute)]">
          The more you say, the closer it lands. Oil especially — it is usually the biggest number
          in a home-cooked dish and the easiest to leave out.
        </p>
      </div>

      <button
        type="button"
        onClick={guess}
        disabled={!name.trim() || thinking}
        className="btn btn-ghost w-full"
      >
        {thinking ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
        {thinking ? "Working it out" : "Estimate it for me"}
      </button>

      {estimate && (
        <div className="card p-3.5">
          <p className="text-xs font-semibold">
            Estimated from {estimate.ingredients.length} ingredients
            {estimate.serves > 1 && `, serving ${estimate.serves}`}
          </p>
          <ul className="num mt-2 space-y-1 text-[11px] text-[var(--color-mute)]">
            {estimate.ingredients.map((ing, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {ing.name}
                  {!ing.matched && <span className="ml-1 text-[var(--color-warn)]">not found</span>}
                </span>
                <span className="shrink-0">
                  {ing.grams} g · {ing.kcal} kcal
                </span>
              </li>
            ))}
          </ul>
          {estimate.note && (
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-warn)]">
              {estimate.note}
            </p>
          )}
          <p className="mt-2 border-t border-[var(--color-line)] pt-2 text-[11px] leading-relaxed text-[var(--color-mute)]">
            Every ingredient was looked up in a real database and the totals added up here — no
            calorie figure came from the AI. The <em>recipe</em> is the guess. Correct any line by
            editing the numbers below.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          ["kcal", "Calories"],
          ["protein", "Protein (g)"],
          ["carbs", "Carbs (g)"],
          ["fat", "Fat (g)"],
          ["fibre", "Fibre (g)"],
        ].map(([k, label]) => (
          <div key={k}>
            <label className="label" htmlFor={k}>
              {label} <span className="normal-case tracking-normal">/100 g</span>
            </label>
            <input
              id={k}
              inputMode="decimal"
              className="field num"
              value={per[k]}
              onChange={(e) => setPer({ ...per, [k]: e.target.value })}
              placeholder="0"
            />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="mgrams">
            You ate (g)
          </label>
          <input
            id="mgrams"
            inputMode="decimal"
            required
            className="field num"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
          />
        </div>
      </div>

      <button type="submit" disabled={busy || !name} className="btn btn-primary w-full">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} Log it
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */

/** Local preview only. The stored entry is always scaled on the server. */
function scale(per100g, grams) {
  const f = grams / 100;
  return {
    kcal: per100g.kcal * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
    fibre: per100g.fibre * f,
    sugar: per100g.sugar * f,
    satFat: per100g.satFat * f,
    sodium: per100g.sodium * f,
  };
}

/**
 * Shrink a photo before it leaves the phone.
 *
 * A modern phone camera produces 4-8 MB, which is slow to upload on mobile
 * data and larger than the model needs — 1280px is plenty to identify a
 * plate of food.
 */
async function downscale(file, max = 1280, quality = 0.82) {
  const bitmap = await createImageBitmap(file);
  const scaleBy = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scaleBy);
  canvas.height = Math.round(bitmap.height * scaleBy);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
