"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Loader2, Trash2, Sparkles, Ruler, Lock } from "lucide-react";
import { get, post, del, today, prettyDate } from "@/lib/client";
import { useResource } from "@/lib/useResource";
import { isNative, nativePhoto } from "@/lib/native";
import { VaultProvider, VaultGate, SealedImage, useVault } from "@/components/PhotoVault";

/**
 * Progress: the before-and-after, and the tape.
 *
 * Photos are the honest record when the scale stalls — recomposition shows up
 * in a mirror months before it shows up in a number. They are stored in a
 * private bucket and only ever shown through URLs that expire, which is said
 * plainly on the page because people should know before they upload.
 */
export default function ProgressPage() {
  const [tab, setTab] = useState("photos");

  return (
    <div className="space-y-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="display text-3xl">Progress</h1>
        <Link
          href="/coach"
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-volt)]"
        >
          <Sparkles size={15} /> Review
        </Link>
      </header>

      <div className="flex gap-1 rounded-xl bg-[var(--color-slab-2)] p-1">
        {[
          ["photos", "Photos", Camera],
          ["tape", "Measurements", Ruler],
        ].map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
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

      {tab === "photos" ? (
        <VaultProvider>
          <Photos />
        </VaultProvider>
      ) : (
        <Tape />
      )}
    </div>
  );
}

const POSES = ["front", "side", "back"];

function Photos() {
  const fileRef = useRef(null);
  const [pose, setPose] = useState("front");
  const [busy, setBusy] = useState(false);

  const { state, retentionDays, seal } = useVault();

  const fetcher = useCallback(() => get("/api/progress/photos"), []);
  const { data, error, reload, setError } = useResource(fetcher);

  /* Sealed here, in this function, before anything leaves the device. The
     server is handed ciphertext and a nonce and has no way back to the
     picture — see components/PhotoVault.jsx. */
  async function upload(dataUrl) {
    setBusy(true);
    setError("");
    try {
      const { iv, cipher } = await seal(jpegBytes(dataUrl));
      await post("/api/progress/photos", { cipher, iv, pose, date: today() });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that photo.");
    } finally {
      setBusy(false);
    }
  }

  const comparison = data?.comparison?.[pose];
  const list = data?.byPose?.[pose] ?? [];

  if (state !== "open") return <VaultGate />;

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="card p-4 text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      <div className="flex gap-1.5">
        {POSES.map((p) => (
          <button
            key={p}
            onClick={() => setPose(p)}
            className="flex-1 rounded-lg border py-2 text-xs font-semibold capitalize"
            style={{
              borderColor: pose === p ? "var(--color-volt)" : "var(--color-line)",
              color: pose === p ? "var(--color-volt)" : "var(--color-mute)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) upload(await downscale(file));
          e.target.value = "";
        }}
      />

      <button
        disabled={busy}
        onClick={async () => {
          if (isNative()) {
            const p = await nativePhoto();
            if (p) upload(p);
          } else fileRef.current?.click();
        }}
        className="btn btn-primary w-full"
      >
        {busy ? <Loader2 className="animate-spin" size={17} /> : <Camera size={17} />}
        Add today&apos;s {pose} photo
      </button>

      <p className="flex gap-1.5 px-1 text-xs leading-relaxed text-[var(--color-mute)]">
        <Lock size={13} className="mt-px shrink-0" />
        Encrypted on this device before it is uploaded. Nobody who runs this app can open it, and it
        is never sent to the AI. The image is deleted automatically after{" "}
        {retentionMonths(retentionDays)}; the date and your weight are kept.
      </p>

      {comparison && (
        <section className="card p-4">
          <h2 className="label">Then and now</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["First", comparison.first],
              ["Latest", comparison.latest],
            ].map(([label, p]) => (
              <figure key={label}>
                <SealedImage
                  url={p.url}
                  iv={p.iv}
                  alt={`${label} ${pose} photo`}
                  className="aspect-[3/4] w-full rounded-xl object-cover"
                />
                <figcaption className="mt-1.5 text-xs text-[var(--color-mute)]">
                  {label} · {prettyDate(p.on_date)}
                  {p.weight_kg && <span className="num"> · {p.weight_kg} kg</span>}
                </figcaption>
              </figure>
            ))}
          </div>
          {comparison.first.weight_kg && comparison.latest.weight_kg && (
            <p className="num mt-3 text-center text-sm font-semibold text-[var(--color-volt)]">
              {comparison.latest.weight_kg - comparison.first.weight_kg > 0 ? "+" : ""}
              {(comparison.latest.weight_kg - comparison.first.weight_kg).toFixed(1)} kg
              <span className="ml-1.5 font-normal text-[var(--color-mute)]">
                over {daysBetween(comparison.first.on_date, comparison.latest.on_date)} days
              </span>
            </p>
          )}
        </section>
      )}

      {list.length > 0 && (
        <section>
          <h2 className="label">All {pose} photos</h2>
          <ul className="grid grid-cols-3 gap-2">
            {list.map((p) => (
              <li key={p.id} className="relative">
                <SealedImage
                  url={p.url}
                  iv={p.iv}
                  alt={prettyDate(p.on_date)}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[10px]">
                  {prettyDate(p.on_date)}
                </span>
                <button
                  aria-label={`Delete photo from ${p.on_date}`}
                  onClick={async () => {
                    await del(`/api/progress/photos?id=${p.id}`);
                    reload();
                  }}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/70"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!list.length && !busy && (
        <p className="card p-6 text-center text-sm leading-relaxed text-[var(--color-mute)]">
          No {pose} photos yet. Take one now — same spot, same light, same time of day. In eight
          weeks it is the most convincing thing in this app.
        </p>
      )}
    </div>
  );
}

const FIELDS = [
  ["neck_cm", "Neck"],
  ["chest_cm", "Chest"],
  ["waist_cm", "Waist"],
  ["hips_cm", "Hips"],
  ["thigh_cm", "Thigh"],
  ["arm_cm", "Arm"],
];

function Tape() {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const fetcher = useCallback(() => get("/api/progress/measurements"), []);
  const { data, reload } = useResource(fetcher);
  const rows = data?.measurements ?? [];

  const latest = rows.at(-1);
  const first = rows[0];

  return (
    <div className="space-y-4">
      <form
        className="card space-y-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setNote("");
          try {
            const payload = {};
            for (const [k] of FIELDS) if (draft[k]) payload[k] = Number(draft[k]);
            const res = await post("/api/progress/measurements", { date: today(), ...payload });
            if (res.derived && res.measurement.body_fat_pct) {
              setNote(
                `Body fat works out at about ${res.measurement.body_fat_pct}% from those measurements.`,
              );
            }
            setDraft({});
            reload();
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="text-xs leading-relaxed text-[var(--color-mute)]">
          Measure relaxed, first thing, same spot each time. Neck and waist alone are enough for
          Macro to work out your body fat — and that makes every calorie target more accurate,
          because expenditure tracks lean mass, not total weight.
        </p>

        <div className="grid grid-cols-3 gap-2.5">
          {FIELDS.map(([k, label]) => (
            <div key={k}>
              <label className="label" htmlFor={k}>
                {label}
              </label>
              <input
                id={k}
                inputMode="decimal"
                className="field num px-2 text-sm"
                value={draft[k] ?? ""}
                placeholder="cm"
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy && <Loader2 className="animate-spin" size={16} />} Save measurements
        </button>
        {note && <p className="text-sm text-[var(--color-volt)]">{note}</p>}
      </form>

      {latest && (
        <section className="card p-4">
          <h2 className="label">Latest · {prettyDate(latest.on_date)}</h2>
          <dl className="grid grid-cols-3 gap-3">
            {FIELDS.map(([k, label]) => {
              const now = latest[k];
              const then = first?.[k];
              const delta = now != null && then != null && rows.length > 1 ? now - then : null;
              return (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--color-mute)]">
                    {label}
                  </dt>
                  <dd className="num font-semibold">
                    {now != null ? `${now}` : "—"}
                    {delta != null && delta !== 0 && (
                      <span
                        className="ml-1 text-[10px] font-normal"
                        style={{ color: delta < 0 ? "var(--color-fibre)" : "var(--color-warn)" }}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {latest.body_fat_pct && (
            <p className="num mt-3 border-t border-[var(--color-line)] pt-3 text-sm">
              Body fat{" "}
              <span className="font-bold text-[var(--color-volt)]">{latest.body_fat_pct}%</span>
              <span className="ml-1.5 font-sans text-xs text-[var(--color-mute)]">
                — feeding your calorie targets
              </span>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const retentionMonths = (days) =>
  days >= 3650
    ? "ten years"
    : days >= 365
      ? `${Math.round(days / 365)} year${days >= 730 ? "s" : ""}`
      : `${Math.round(days / 30)} months`;

/** The JPEG the canvas produced, as bytes ready to be sealed. */
function jpegBytes(dataUrl) {
  const raw = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function downscale(file, max = 1400, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const by = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * by);
  canvas.height = Math.round(bitmap.height * by);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}
