/**
 * Push config that is safe to reason about from tests. The private VAPID
 * key must never appear in any object returned to a client route.
 */
export function pushIsConfigured(env: NodeJS.Dict<string> = process.env): boolean {
  return Boolean(env.PUSH_VAPID_PUBLIC_KEY && env.PUSH_VAPID_PRIVATE_KEY);
}

export function clientPushConfig(env: NodeJS.Dict<string> = process.env): { publicKey: string | null } {
  return { publicKey: env.PUSH_VAPID_PUBLIC_KEY || null };
}
