import { withUser, ok, fail, body, str, num } from "@/lib/api";
import { getVault, createVault, setRetention } from "@/lib/db";

/**
 * Setting up, and checking, the photo vault.
 *
 * This route hands out a salt and a verifier. Neither is a key. Someone who
 * takes both, plus every encrypted photo and the service key, still has
 * nothing they can look at — they would have to guess the passphrase, at
 * 310,000 PBKDF2 iterations a guess.
 *
 * There is no reset here, and that is on purpose. A reset the operator can
 * perform is a door the operator can be compelled to open, which would make
 * the whole arrangement decorative.
 */

export const GET = withUser(async (uid) => {
  const vault = await getVault(uid);
  return ok({ vault });
});

export const POST = withUser(async (uid, req) => {
  const b = await body(req);

  // Setting up twice would orphan every photo sealed under the first key.
  if (await getVault(uid)) return fail("Your vault is already set up.", 409);

  const salt = str(b.salt, 64);
  const verifier = str(b.verifier, 256);
  if (!salt || !verifier) return fail("Could not set that up.");

  const days = Math.round(num(b.retentionDays, 7, 3650) ?? 180);
  const vault = await createVault(uid, salt, verifier, days);
  return vault ? ok({ vault }) : fail("Could not set that up.", 500);
});

export const PATCH = withUser(async (uid, req) => {
  const b = await body(req);
  const days = num(b.retentionDays, 7, 3650);
  if (days == null) return fail("Keep photos for between a week and ten years.");
  return (await setRetention(uid, Math.round(days)))
    ? ok({ retentionDays: Math.round(days) })
    : fail("Could not change that.", 500);
});
