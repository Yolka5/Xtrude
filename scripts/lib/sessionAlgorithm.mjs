/**
 * Session clustering, originally ported line-for-line from
 * phase0_validate.py's cluster_sessions(). The clustering pass (idle-gap
 * grouping, lead-in credit, the 4h cap) is still that validated algorithm.
 * The noise filter below it is not: phase0_validate.py and the original
 * port kept a cluster whenever it had >= MIN_EVENTS, which was only ever a
 * proxy for "this was a real work session, not an autosave tick." Measured
 * against real history, event count alone let a 5-event cluster spanning 4
 * seconds through while correctly keeping true short sessions (4m38s,
 * 10m39s, 15m8s). Span is what actually separates the two, so a cluster is
 * now kept only if it clears BOTH thresholds. Retune here - both constants
 * are named and live at the top of the file on purpose.
 */

export const IDLE_THRESHOLD_MINUTES = 20;
export const LEAD_IN_MINUTES = 5;
export const MAX_SESSION_HOURS = 4;
export const MIN_EVENTS = 2;
export const MIN_SPAN_MINUTES = 2;

const IDLE_THRESHOLD_SECONDS = IDLE_THRESHOLD_MINUTES * 60;
const LEAD_IN_SECONDS = LEAD_IN_MINUTES * 60;
const MAX_SESSION_SECONDS = MAX_SESSION_HOURS * 3600;
const MIN_SPAN_SECONDS = MIN_SPAN_MINUTES * 60;

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
      kept: cluster.length >= MIN_EVENTS && spanSeconds >= MIN_SPAN_SECONDS,
      documentIds,
    };
  });
}
