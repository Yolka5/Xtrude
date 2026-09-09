/**
 * Stamps a build id into the exported service worker.
 *
 * Without this the cache name never changes, so a returning visitor can be
 * served last deploy's HTML pointing at chunk filenames that no longer exist.
 * Runs as `postbuild` against out/sw.js - public/sw.js keeps its "dev" default.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "out", "sw.js");

if (!existsSync(target)) {
  console.error("stamp-sw: out/sw.js not found - did the export run?");
  process.exit(1);
}

const build =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);

const src = readFileSync(target, "utf8");
const out = src.replace('const VERSION = "dev";', `const VERSION = ${JSON.stringify(build)};`);
if (src === out) {
  console.error("stamp-sw: VERSION placeholder not found in out/sw.js");
  process.exit(1);
}
writeFileSync(target, out);
console.log(`stamp-sw: cache version -> ${build}`);
