import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The one Supabase client this app uses, built with the service-role key.
 * `import "server-only"` above turns any accidental import from a client
 * component into a build error rather than a leaked key - Phase 1 is
 * single-user with no client-side Supabase usage at all, so there is no
 * legitimate reason for this module to ever reach the browser.
 *
 * Built lazily, on first real use, rather than as a module-level constant:
 * every page that reads data imports this module, and Next evaluates route
 * modules while collecting page data at build time - a top-level
 * `createClient(...)` that throws on a missing env var would fail the build
 * itself, not just a request, even though these pages are all
 * `force-dynamic` and never actually run at build time.
 */
function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill it in - see supabase/README.md.`
    );
  }
  return value;
}

let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
  }
  return client;
}
