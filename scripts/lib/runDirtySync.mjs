/**
 * The one Onshape-read path for live capture, for exactly one user: that
 * user's documents the webhook endpoint flagged dirty (`last_notified_at`
 * newer than `last_synced_at`) get one documenthistory pull each, then that
 * user's sessions/daily_stats are rebuilt with the still-editing tail
 * excluded.
 *
 * Called from:
 *   - POST /api/sync (Today page load: the signed-in viewer only, per-user
 *     15-minute throttle lives in the route)
 *   - GET/POST /api/cron/sync (GitHub Actions hourly: every user in turn,
 *     one call budget shared across them)
 *
 * Never called from the webhook handler itself - that handler only stamps
 * last_notified_at, so a burst of deliveries costs zero Onshape calls.
 *
 * `getClient` must resolve to `{ client }` acting as *this* user (their own
 * OAuth token, or the server API keys only for the account that owns them)
 * built on `budget`, or `{ client: null, reason }` to skip. It is only
 * called when something is dirty, so a clean user costs no token refresh
 * and no Onshape call.
 */
import { rebuildSessions } from "./sessionRebuild.mjs";
import { ingestDocumentHistory } from "./ingestDocument.mjs";
import { isBudgetExceeded } from "./callBudget.mjs";
import { loadOnshapeUserId, requireUserId } from "./userScope.mjs";

export const MAX_SYNC_ONSHAPE_CALLS = 20;

/**
 * @param {*} supabase
 * @param {{ userId: string, getClient: () => Promise<{ client: any, reason?: string }>, budget: any, now?: Date, trigger?: string }} opts
 */
export async function runDirtySync(supabase, { userId, getClient, budget, now = new Date(), trigger = "cron" } = {}) {
  requireUserId(userId, "runDirtySync");
  if (!budget) throw new Error("runDirtySync: budget is required");
  const startCalls = budget.callsUsed();
  const summary = {
    at: now.toISOString(),
    trigger,
    userId,
    documentsChecked: 0,
    documentsSynced: 0,
    eventsWritten: 0,
    skippedReason: null,
    errors: [],
    rebuild: null,
    callsUsed: 0,
    budget: budget.snapshot(),
  };

  const { data: dirtyDocs, error: dirtyErr } = await supabase
    .from("tracked_documents")
    .select("id, onshape_document_id, onshape_workspace_id, name, last_notified_at, last_synced_at, user_id")
    .eq("user_id", userId)
    .not("last_notified_at", "is", null);
  if (dirtyErr) throw new Error(`load_failed: ${dirtyErr.message}`);

  const toSync = (dirtyDocs ?? []).filter(
    (d) => !d.last_synced_at || new Date(d.last_notified_at) > new Date(d.last_synced_at)
  );
  summary.documentsChecked = toSync.length;

  if (toSync.length > 0) {
    const authorOnshapeId = await loadOnshapeUserId(supabase, userId);
    const { client: onshape, reason } = (await getClient()) ?? { client: null };
    if (!onshape) {
      summary.skippedReason = reason ?? "no_onshape_credentials";
    } else {
      for (const doc of toSync) {
        if (budget.remaining() < 1) {
          summary.errors.push(`stopped at cap (${budget.callsUsed()}/${budget.maxCalls}) before ${doc.name}`);
          break;
        }
        try {
          const ingested = await ingestDocumentHistory(supabase, onshape, doc, { now, authorOnshapeId });
          summary.documentsSynced++;
          summary.eventsWritten += ingested.eventsWritten;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (isBudgetExceeded(err)) {
            summary.errors.push(message);
            break;
          }
          summary.errors.push(`${doc.name}: ${message}`);
        }
      }
    }
  }

  summary.callsUsed = budget.callsUsed() - startCalls;
  summary.budget = budget.snapshot();

  try {
    summary.rebuild = await rebuildSessions(supabase, { excludeLiveTail: true, now, userId });
  } catch (err) {
    summary.errors.push(`rebuildSessions: ${err instanceof Error ? err.message : String(err)}`);
  }

  return summary;
}
