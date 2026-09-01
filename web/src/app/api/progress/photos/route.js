import { withUser, ok, fail, body, str, oneOf } from "@/lib/api";
import { deletePhoto, listPhotos, savePhoto, signPhoto, isoDate } from "@/lib/db";

/**
 * Progress photos.
 *
 * These arrive already encrypted. The browser seals each image with a key
 * derived from a passphrase that is never sent here, so what this route
 * handles is a blob of noise with a nonce attached — and what the storage
 * bucket, the database, a backup and the operator all hold is that same
 * noise. Nobody on this side can look at these images, which is the only
 * version of "private" that survives contact with someone determined.
 *
 * What is kept in the clear is deliberately the minimum that makes the
 * feature work without the pictures: the date, which pose, and the weight
 * that day. That is what the progress chart is drawn from, and it is what
 * remains after the bytes expire.
 */

const POSES = ["front", "side", "back"];

// Ciphertext plus base64 expansion, against a client that downscales to
// roughly 1400px. Generous, and still a ceiling.
const MAX_BYTES = 6_000_000;

export const GET = withUser(async (uid) => {
  const rows = await listPhotos(uid);

  // Sign them all at once; a comparison view needs both ends of the range.
  // A purged row has no path and simply carries no URL.
  const photos = await Promise.all(
    rows.map(async (p) => ({ ...p, url: p.path ? await signPhoto(p.path) : null })),
  );

  /* Group by pose so "front, then and now" is one lookup. Comparing a front
     shot against a side shot tells you nothing. */
  const byPose = { front: [], side: [], back: [] };
  for (const p of photos) byPose[p.pose]?.push(p);

  const withImage = (list) => list.filter((p) => p.url);

  return ok({
    photos,
    byPose,
    comparison: Object.fromEntries(
      Object.entries(byPose).map(([pose, list]) => {
        const live = withImage(list);
        return [pose, live.length >= 2 ? { first: live[0], latest: live.at(-1) } : null];
      }),
    ),
  });
});

export const POST = withUser(async (uid, req) => {
  const b = await body(req);

  const cipher = str(b.cipher, MAX_BYTES + 100_000);
  const iv = str(b.iv, 64);
  if (!cipher || !iv) return fail("That photo was not sealed. Set up the vault first.");

  // Base64 only. Anything else means the client sent something unencrypted,
  // and storing that would quietly break the promise this route makes.
  if (!/^[A-Za-z0-9+/]+=*$/.test(cipher) || !/^[A-Za-z0-9+/]+=*$/.test(iv)) {
    return fail("That photo was not sealed properly.");
  }

  const bytes = Buffer.from(cipher, "base64");
  if (bytes.byteLength > MAX_BYTES) return fail("That photo is too large.", 413);

  const photo = await savePhoto(
    uid,
    isoDate(b.date),
    oneOf(b.pose, POSES) ?? "front",
    new Uint8Array(bytes),
    iv,
  );

  return ok({ photo: { ...photo, url: photo.path ? await signPhoto(photo.path) : null } });
});

export const DELETE = withUser(async (uid, req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Which photo?");
  return (await deletePhoto(uid, id))
    ? ok({ deleted: true })
    : fail("That photo is not there.", 404);
});
