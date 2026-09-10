/**
 * Session clustering, ported line-for-line from phase0_validate.py's
 * cluster_sessions(). Same constants, same behaviour - this is the
 * validated algorithm, not a reinterpretation of it. Kept as a pure
 * function (events in, sessions out, no I/O) so scripts/recompute-
 * sessions.mjs can rerun it against a changed constant without anything
 * else needing to change.
 */

export const IDLE_THRESHOLD_MINUTES = 20;
export const LEAD_IN_MINUTES = 5;
export const MAX_SESSION_HOURS = 4;
export const MIN_EVENTS = 3;

const IDLE_THRESHOLD_SECONDS = IDLE_THRESHOLD_MINUTES * 60;
const LEAD_IN_SECONDS = LEAD_IN_MINUTES * 60;
const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 3600;

/**
 * @param {{ occurred_at: string, document_id: string }[]} events
 *   Must be pre-sorted oldest-first; each occurred_at is an ISO timestamp.
 * @returns {Array} one entry per cluster, both kept and discarded (caller
 *   filters on `.kept`), mirroring the Python function's return shape.
 */
export function clusterSessions(events) {
  if (events.length === 0) return [];

  const clusters = [];
  let current = [events[0]];
  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    const gapSeconds = (new Date(ev.occurred_at) - new Date(current[current.length - 1].occurred_at)) / 1000;
    if (gapSeconds > IDLE_THRESHOLD_SECONDS) {
      clusters.push(current);
      current = [ev];
    } else {
      current.push(ev);
    }
  }
  clusters.push(current);

  return clusters.map((cluster) => {
    const start = new Date(cluster[0].occurred_at);
    const end = new Date(cluster[cluster.length - 1].occurred_at);
    const spanSeconds = (end - start) / 1000;
    const durationSeconds = Math.min(spanSeconds + LEAD_IN_SECONDS, MAX_SESSION_SECONDS);
    const documentIds = [...new Set(cluster.map((ev) => ev.document_id))];
    return {
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      spanSeconds,
      durationSeconds,
      eventCount: cluster.length,
      clamped: spanSeconds + LEAD_IN_SECONDS > MAX_SESSION_SECONDS,
      kept: cluster.length >= MIN_EVENTS,
      documentIds,
    };
  });
}
