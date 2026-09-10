/**
 * Minimal .env loader for the standalone scripts in this folder (they run
 * as plain `node scripts/x.mjs`, outside Next's own env loading). No
 * dependency on `dotenv` - this is a dozen lines and it's the only thing
 * we need it for.
 *
 * Real environment variables (e.g. set by Vercel, or exported in the shell)
 * always win over .env - this only fills in what's missing.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadEnv() {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return;

  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`\n${name} is not set.`);
    console.error("Copy .env.example to .env and fill it in - see supabase/README.md");
    console.error("for Supabase, or https://dev-portal.onshape.com/keys for Onshape.\n");
    process.exit(1);
  }
  return value;
}
