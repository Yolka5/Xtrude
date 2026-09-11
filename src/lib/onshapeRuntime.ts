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
  maxCalls: number;
}) {
  return makeClientImpl(opts as never);
}

export function rebuildSessions(
  supabase: unknown,
  opts?: { excludeLiveTail?: boolean; now?: Date; userId?: string }
) {
  return rebuildSessionsImpl(supabase, opts as never);
}
