/**
 * The photo vault.
 *
 * Progress photos are the one thing in this app that nobody but the person
 * in them has any business seeing — not the operator, not a database
 * administrator, not whoever ends up with a leaked backup. So they are
 * sealed here, in the browser, before they are uploaded, and the server
 * stores bytes it cannot read.
 *
 * The key comes from a passphrase through PBKDF2. It is never sent anywhere.
 * The consequence is honest and worth stating plainly to the person setting
 * it up: forget the passphrase and the photos are gone. There is no reset,
 * because a reset the operator could perform is a door the operator could be
 * compelled to open.
 *
 * Everything else about a photo — the date, the pose, the weight that day —
 * stays in plain columns. Those are what the progress chart is made of, they
 * are small, and they survive after the image itself has been purged.
 */

const ITERATIONS = 310_000; // OWASP's 2023 floor for PBKDF2-SHA256
const VERIFIER = "macro/photo-vault/v1";

/** Backed by a plain ArrayBuffer, which is what WebCrypto will accept. */
type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = (b: ArrayBuffer | Uint8Array): string => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export const unb64 = (s: string): Bytes =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const randomSalt = (): string => b64(crypto.getRandomValues(new Uint8Array(16)));

/** Passphrase plus salt to an AES-GCM key. Deliberately slow. */
export async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase.normalize("NFKC")), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: unb64(salt), iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    // Not extractable: the key cannot be read back out of the browser, even
    // by this app's own code after a scripting flaw.
    false,
    ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, data: Bytes): Promise<{ iv: string; cipher: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, data,
  );
  return { iv: b64(iv), cipher: b64(cipher) };
}

export async function open(key: CryptoKey, iv: string, cipher: Bytes): Promise<Bytes> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, cipher);
  return new Uint8Array(plain);
}

/**
 * A sealed known string, so a wrong passphrase fails immediately.
 *
 * Without this a typo would decrypt to garbage and be shown as a broken
 * image, which reads as "my photos are lost" rather than "I typed it wrong".
 */
export async function makeVerifier(key: CryptoKey): Promise<string> {
  const { iv, cipher } = await seal(key, enc.encode(VERIFIER) as Bytes);
  return `${iv}.${cipher}`;
}

export async function checkVerifier(key: CryptoKey, verifier: string): Promise<boolean> {
  const [iv, cipher] = verifier.split(".");
  if (!iv || !cipher) return false;
  try {
    return dec.decode(await open(key, iv, unb64(cipher))) === VERIFIER;
  } catch {
    // AES-GCM authentication failed, which is exactly what a wrong
    // passphrase looks like.
    return false;
  }
}

/* --------------------------------------------------------------------- */
/* Keeping the key for the session                                        */
/*                                                                        */
/* IndexedDB can hold a non-extractable CryptoKey, so the passphrase is    */
/* asked for once per device rather than once per page load. The key       */
/* object itself is opaque even to script that gets it back out.          */
/* --------------------------------------------------------------------- */

const DB = "macro-vault";
const STORE = "keys";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const db = await idb();
    return await new Promise<T | null>((resolve) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    // Private browsing, or storage denied. The vault still works; it just
    // asks for the passphrase again.
    return null;
  }
}

export const rememberKey = (uid: string, key: CryptoKey) =>
  withStore<void>("readwrite", (s) => s.put(key, uid));

export const recallKey = (uid: string) =>
  withStore<CryptoKey>("readonly", (s) => s.get(uid));

export const forgetKey = (uid: string) =>
  withStore<void>("readwrite", (s) => s.delete(uid));
