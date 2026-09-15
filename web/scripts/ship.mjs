/**
 * Deploy, then point every domain at what was just deployed.
 *
 * `vercel alias set` pins a domain to one specific deployment, so a plain
 * `vercel deploy --prod` puts new code live at a URL nobody uses and leaves
 * both real domains serving the previous build. That failure is silent — the
 * deploy says "Ready" and the site says nothing at all — so the aliasing is
 * not left to whoever remembers.
 *
 * Adding a domain here is not enough on its own: Firebase refuses Google,
 * Apple and phone sign-in on any domain not in its authorised list, while
 * email keeps working, which reads as three unrelated bugs. Run `npm run
 * doctor` after adding one.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DOMAINS = ["macrofitness.vercel.app", "macro-delta-flax.vercel.app"];

/* The Vercel project builds from `web/` (its Root Directory), so the CLI has to
   run from the repository root — run from inside web/ it looks for web/web. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const vercel = (...args) =>
  execFileSync("npx", ["vercel", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

console.log("Deploying…");
const out = vercel("deploy", "--prod", "--yes");

const url = out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/g)?.at(-1);
if (!url) {
  console.error("Could not find the deployment URL in the CLI output. Nothing was aliased.");
  process.exit(1);
}
console.log(`\nDeployed ${url}`);

for (const domain of DOMAINS) {
  vercel("alias", "set", url, domain);
  console.log(`  ${domain} -> this deployment`);
}

console.log("\nLive:");
for (const d of DOMAINS) console.log(`  https://${d}`);
