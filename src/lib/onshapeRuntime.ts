/**
 * Typed wrappers around the plain .mjs Onshape/session helpers.
 * Next's checker infers the .mjs destructuring without `accessToken` /
 * `userId` even though those arguments are implemented and documented.
 */
import { makeClient as makeClientImpl } from "../../scripts/lib/onshape.mjs";
import { rebuildSessions as rebuildSessionsImpl } from "../../scripts/lib/sessionRebuild.mjs";

export function makeClient(opts: {
  accessKey?: string;
  secretKey?: string;
  accessToken?: string;
  maxCalls?: number;
  budget?: { take: (method: string, path: string) => void; callsUsed: () => number };
}) {
  return makeClientImpl(opts as never);
}

/** One named user's rebuild. There is no default user. */
export function rebuildSessions(
  supabase: unknown,
  opts: { userId: string; excludeLiveTail?: boolean; now?: Date }
) {
  return rebuildSessionsImpl(supabase, opts);
}
