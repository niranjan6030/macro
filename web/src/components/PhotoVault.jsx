"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Check, KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  checkVerifier,
  deriveKey,
  makeVerifier,
  open,
  randomSalt,
  seal as sealBytes,
  recallKey,
  rememberKey,
} from "@/lib/vault";

/**
 * The lock on the progress photos.
 *
 * Every other secret in this app is kept from other people. This one is kept
 * from us as well. The key is made in the browser from a passphrase, the
 * photos are sealed before they are uploaded, and what reaches the server —
 * and therefore the database, the backups, and anyone who ever gets hold of
 * either — is noise.
 *
 * The cost is real and is stated to the person's face before they commit:
 * there is no way to recover a forgotten passphrase. A recovery path we
 * could operate would be a recovery path we could be made to operate, and
 * then none of the rest of this would mean anything.
 */

const Ctx = createContext(null);
export const useVault = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVault outside a VaultProvider");
  return v;
};

export function VaultProvider({ children }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "local";

  const [state, setState] = useState("loading");
  const [key, setKey] = useState(null);
  const [salt, setSalt] = useState(null);
  const [verifier, setVerifier] = useState(null);
  const [retentionDays, setDays] = useState(180);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/progress/vault");
        const { vault } = await res.json();
        if (!live) return;

        if (!vault) {
          setState("absent");
          return;
        }
        setSalt(vault.salt);
        setVerifier(vault.verifier);
        setDays(vault.retention_days);

        // The key may already be on this device from a previous visit, in
        // which case the passphrase is not asked for again.
        const cached = await recallKey(uid);
        if (!live) return;
        if (cached && (await checkVerifier(cached, vault.verifier))) {
          setKey(cached);
          setState("open");
        } else {
          setState("locked");
        }
      } catch {
        if (live) setState("absent");
      }
    })();
    return () => {
      live = false;
    };
  }, [uid]);

  const setUp = useCallback(
    async (passphrase, days) => {
      const s = randomSalt();
      const k = await deriveKey(passphrase, s);
      const v = await makeVerifier(k);

      const res = await fetch("/api/progress/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ salt: s, verifier: v, retentionDays: days }),
      });
      if (!res.ok) return (await res.json()).error ?? "Could not set that up.";

      await rememberKey(uid, k);
      setSalt(s);
      setVerifier(v);
      setDays(days);
      setKey(k);
      setState("open");
      return null;
    },
    [uid],
  );

  const unlock = useCallback(
    async (passphrase) => {
      if (!salt || !verifier) return "Your vault is not set up yet.";
      const k = await deriveKey(passphrase, salt);
      if (!(await checkVerifier(k, verifier))) return "That passphrase does not match.";
      await rememberKey(uid, k);
      setKey(k);
      setState("open");
      return null;
    },
    [salt, verifier, uid],
  );

  const seal = useCallback(
    async (bytes) => {
      if (!key) throw new Error("The vault is locked.");
      return sealBytes(key, bytes);
    },
    [key],
  );

  /**
   * Fetch a sealed photo and turn it into something an <img> can show.
   *
   * The object URL lives only in this tab's memory. Rows written before the
   * vault existed have no nonce and are served as they are.
   */
  const reveal = useCallback(
    async (url, iv) => {
      if (!iv) return url;
      if (!key) return null;
      try {
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        const plain = await open(key, iv, bytes);
        return URL.createObjectURL(new Blob([plain], { type: "image/jpeg" }));
      } catch {
        return null;
      }
    },
    [key],
  );

  const setRetention = useCallback(async (days) => {
    const res = await fetch("/api/progress/vault", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ retentionDays: days }),
    });
    if (res.ok) setDays(days);
  }, []);

  const value = useMemo(
    () => ({ state, retentionDays, setUp, unlock, seal, reveal, setRetention }),
    [state, retentionDays, setUp, unlock, seal, reveal, setRetention],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* --------------------------------------------------------------------- */

const RETENTION = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
  { days: 3650, label: "10 years" },
];

/** Shown in place of the photo grid until the vault is open. */
export function VaultGate() {
  const { state, setUp, unlock } = useVault();
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [days, setDays] = useState(180);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (state === "loading") {
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-mute)]">
        <Loader2 className="animate-spin" size={16} /> Checking your vault…
      </p>
    );
  }
  if (state === "open") return null;

  const first = state === "absent";

  const go = async () => {
    setError(null);
    if (first) {
      if (pass.length < 10) {
        setError("Use at least ten characters.");
        return;
      }
      if (pass !== again) {
        setError("Those two do not match.");
        return;
      }
    }
    setBusy(true);
    try {
      setError(first ? await setUp(pass, days) : await unlock(pass));
    } finally {
      setBusy(false);
      setPass("");
      setAgain("");
    }
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[var(--color-volt)]" />
        <div>
          <h2 className="font-semibold">
            {first ? "Lock your progress photos" : "Unlock your photos"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-mute)]">
            {first
              ? "Your photos are encrypted on this device before they are uploaded. Nobody who runs this app, holds the database, or gets a copy of a backup can open them — only you, with this passphrase."
              : "Enter the passphrase you set. It is checked here, on your device; it is never sent anywhere."}
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div>
          <label className="label" htmlFor="vault-pass">
            Passphrase
          </label>
          <input
            id="vault-pass"
            type="password"
            value={pass}
            autoComplete={first ? "new-password" : "current-password"}
            onChange={(e) => setPass(e.target.value)}
            className="field"
            placeholder={first ? "Something you will not forget" : ""}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !first) go();
            }}
          />
        </div>

        {first && (
          <>
            <div>
              <label className="label" htmlFor="vault-again">
                Type it again
              </label>
              <input
                id="vault-again"
                type="password"
                value={again}
                autoComplete="new-password"
                onChange={(e) => setAgain(e.target.value)}
                className="field"
              />
            </div>

            <div>
              <span className="label">Keep each photo for</span>
              <div className="flex flex-wrap gap-1.5">
                {RETENTION.map((r) => (
                  <button
                    key={r.days}
                    type="button"
                    onClick={() => setDays(r.days)}
                    aria-pressed={days === r.days}
                    className="chip"
                    style={
                      days === r.days
                        ? { color: "var(--color-volt)", borderColor: "var(--color-volt)" }
                        : undefined
                    }
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-mute)]">
                After that the image is deleted automatically. The date, the pose and your weight
                that day are kept — that is what the chart is drawn from, and it costs a few bytes
                instead of a few megabytes. You can change this later.
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-bad)]">
          {error}
        </p>
      )}

      {first && (
        <p className="flex gap-1.5 rounded-lg bg-[var(--color-slab-2)] p-3 text-[11px] leading-relaxed text-[var(--color-mute)]">
          <KeyRound size={13} className="mt-px shrink-0" />
          There is no way to reset this. If you forget the passphrase the photos cannot be recovered
          — not by you and not by us. That is the trade for nobody else being able to open them.
        </p>
      )}

      <button disabled={busy || !pass} onClick={go} className="btn btn-primary w-full">
        {busy ? (
          <Loader2 className="animate-spin" size={16} />
        ) : first ? (
          <Lock size={16} />
        ) : (
          <Check size={16} />
        )}
        {first ? "Lock them" : "Unlock"}
      </button>
    </div>
  );
}

/**
 * A sealed photo, decrypted for display.
 *
 * The object URL is revoked when the element goes away, so a long session
 * browsing a year of photos does not quietly hold all of them in memory.
 */
export function SealedImage({ url, iv, alt, className }) {
  const { reveal } = useVault();
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!url) return;
    let live = true;
    let made = null;

    reveal(url, iv).then((u) => {
      if (!live) {
        if (u?.startsWith("blob:")) URL.revokeObjectURL(u);
        return;
      }
      made = u?.startsWith("blob:") ? u : null;
      setSrc(u);
    });

    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [url, iv, reveal]);

  // Derived rather than cleared in the effect: a row whose bytes were purged
  // has no URL, and must not go on showing the previous photo.
  const shown = url ? src : null;

  if (!shown) {
    return (
      <div className={`grid place-items-center bg-[var(--color-slab-2)] ${className ?? ""}`}>
        <Lock size={16} className="text-[var(--color-mute)]" />
      </div>
    );
  }
  /* eslint-disable-next-line @next/next/no-img-element -- a blob URL held in this tab */
  return <img src={shown} alt={alt} className={className} />;
}
