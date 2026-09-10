import "server-only";

/**
 * Shared env accessor for the Phase 1b server routes (webhook endpoint,
 * cron jobs) - same "fail loudly, not silently" shape as
 * src/lib/db/client.ts's getEnv, factored out here since three different
 * route files need it and none of them should each grow their own copy.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Set it in the Vercel project's environment variables.`);
  }
  return value;
}
