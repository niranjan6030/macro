/**
 * Assemble the domain modules so plain Node can import them.
 *
 * `npm run check` exercises the fitness and nutrition modules directly rather
 * than through Next. The sources are plain ES modules already, so there is no
 * compile step — they are copied into .check/ and given two fix-ups: Node's
 * ESM resolver needs explicit .js extensions on relative imports (Next's
 * bundler does not), and the output directory needs its own package.json to
 * be treated as ES modules.
 *
 * This lives in a script rather than a shell one-liner in package.json
 * because the regex backreference does not survive JSON escaping.
 */
import { readdir, readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import { join } from "node:path";

const ROOT = ".check";
const SOURCES = [
  ["src/lib/fitness", "fitness"],
  ["src/lib/nutrition", "nutrition"],
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name.endsWith(".js")) yield path;
  }
}

await rm(ROOT, { recursive: true, force: true });
await mkdir(ROOT, { recursive: true });
for (const [from, to] of SOURCES) {
  await cp(from, join(ROOT, to), { recursive: true });
}

let patched = 0;
for await (const file of walk(ROOT)) {
  const before = await readFile(file, "utf8");
  // Only relative specifiers, and only ones without an extension already.
  const after = before.replace(
    /(from\s+["'])(\.[^"']*?)(["'])/g,
    (whole, open, spec, close) => (spec.endsWith(".js") ? whole : `${open}${spec}.js${close}`),
  );
  if (after !== before) { await writeFile(file, after); patched++; }
}

await writeFile(join(ROOT, "package.json"), '{"type":"module"}\n');
console.log(`prepared ${ROOT} (${patched} files patched)`);
