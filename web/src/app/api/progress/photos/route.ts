import { withUser, ok, fail, body, str, oneOf } from "@/lib/api";
import { deletePhoto, listPhotos, savePhoto, signPhoto, isoDate } from "@/lib/db";

/**
 * Progress photos.
 *
 * These are the most personal thing the app holds, so they live in a private
 * bucket and are only ever handed out as signed URLs that expire in minutes.
 * Nothing here is publicly addressable, and the AI never sees them — they are
 * for the person's own before-and-after comparison and nothing else.
 */

const POSES = ["front", "side", "back"] as const;
const MAX_BYTES = 6_000_000;

export const GET = withUser(async (uid) => {
  const rows = await listPhotos(uid);

  // Sign them all at once; a comparison view needs both ends of the range.
  const photos = await Promise.all(
    rows.map(async (p) => ({ ...p, url: await signPhoto(p.path) })),
  );

  /* Group by pose so "front, then and now" is one lookup. Comparing a front
     shot against a side shot tells you nothing. */
  const byPose: Record<string, typeof photos> = { front: [], side: [], back: [] };
  for (const p of photos) byPose[p.pose]?.push(p);

  return ok({
    photos,
    byPose,
    comparison: Object.fromEntries(
      Object.entries(byPose).map(([pose, list]) => [
        pose,
        list.length >= 2 ? { first: list[0], latest: list.at(-1) } : null,
      ]),
    ),
  });
});

export const POST = withUser(async (uid, req) => {
  const b = await body(req);
  const image = str(b.image, MAX_BYTES + 100_000);
  if (!image?.startsWith("data:image/")) return fail("Choose a photo.");

  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/i.exec(image);
  if (!m) return fail("Use a JPEG, PNG or WebP image.");

  const bytes = Buffer.from(m[2], "base64");
  if (bytes.byteLength > MAX_BYTES) return fail("That photo is too large.", 413);

  const photo = await savePhoto(
    uid,
    isoDate(b.date),
    oneOf(b.pose, POSES) ?? "front",
    new Uint8Array(bytes),
    m[1].toLowerCase(),
  );

  return ok({ photo: { ...photo, url: await signPhoto(photo.path) } });
});

export const DELETE = withUser(async (uid, req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return fail("Which photo?");
  return (await deletePhoto(uid, id))
    ? ok({ deleted: true })
    : fail("That photo is not there.", 404);
});
