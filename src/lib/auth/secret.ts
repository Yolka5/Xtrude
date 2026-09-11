/**
 * Signing / encryption key for sessions and OAuth tokens at rest.
 * AUTH_SECRET is preferred; CRON_SECRET is the fallback so this undeployed
 * branch works locally without a new Vercel env var.
 */
export function getAuthSecret(): string | undefined {
  const value = process.env.AUTH_SECRET || process.env.CRON_SECRET;
  if (!value || value.length < 16) return undefined;
  return value;
}
