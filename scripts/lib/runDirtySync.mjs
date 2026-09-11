/**
 * The one Onshape-read path for live capture: documents the webhook
 * endpoint flagged dirty (`last_notified_at` newer than `last_synced_at`)
 * get one documenthistory pull each, then sessions/daily_stats are rebuilt
 * with the still-editing tail excluded.
 *
 * Called from:
 *   - POST /api/sync (Today page load, 15-minute throttle lives in the route)
 *   - GET/POST /api/cron/sync (GitHub Actions hourly backstop, CRON_SECRET)
 *
 * Never called from the webhook handler itself - that handler only stamps
 * last_notified_at, so a burst of deliveries costs zero Onshape calls.
 */
import { makeClient } from "./onshape.mjs";
import { rebuildSessions } from "./sessionRebuild.mjs";
import { ingestDocumentHistory } from "./ingestDocument.mjs";
import { APP_USER_ID } from "./appUser.mjs";
import { createCallBudget, isBudgetExceeded, maxCallsPerRun } from "./callBudget.mjs";

export const MAX_SYNC_ONSHAPE_CALLS = 20;

/**
 * @param {*} supabase
 * @param {{ accessKey: string, secretKey: string, now?: Date, trigger?: string, maxCalls?: number }} opts
 */
export async function runDirtySync(supabase, { accessKey, secretKey, now = new Date(), trigger = "cron", maxCalls } = {}) {
  const budget = createCallBudget(maxCalls ?? maxCallsPerRun());
  const summary = {
    at: now.toISOString(),
    trigger,
    documentsChecked: 0,
    documentsSynced: 0,
    eventsWritten: 0,
    errors: [],
    rebuild: null,
    callsUsed: 0,
    budget: budget.snapshot(),
  };

  const { data: dirtyDocs, error: dirtyErr } = await supabase
    .from("tracked_documents")
    .select("id, onshape_document_id, onshape_workspace_id, name, last_notified_at, last_synced_at, user_id")
    .eq("user_id", APP_USER_ID)
    .not("last_notified_at", "is", null);
  if (dirtyErr) throw new Error(`load_failed: ${dirtyErr.message}`);

  const toSync = (dirtyDocs ?? []).filter(
    (d) => !d.last_synced_at || new Date(d.last_notified_at) > new Date(d.last_synced_at)
  );
  summary.documentsChecked = toSync.length;

  if (toSync.length > 0) {
    const onshape = makeClient({
      accessKey,
      secretKey,
      budget,
    });

    for (const doc of toSync) {
      if (budget.remaining() < 1) {
        summary.errors.push(
          `stopped at cap (${budget.callsUsed()}/${budget.maxCalls}) before ${doc.name}`
        );
        break;
      }
      try {
        const ingested = await ingestDocumentHistory(supabase, onshape, doc, { now });
        summary.documentsSynced++;
        summary.eventsWritten += ingested.eventsWritten;
      } catch (err) {
        if (isBudgetExceeded(err)) {
          summary.errors.push(err instanceof Error ? err.message : String(err));
          break;
        }
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${doc.name}: ${message}`);
      }
    }
    summary.callsUsed = budget.callsUsed();
  }

  summary.budget = budget.snapshot();

  try {
    summary.rebuild = await rebuildSessions(supabase, { excludeLiveTail: true, now });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`rebuildSessions: ${message}`);
  }

  await supabase.from("app_state").upsert({ key: "last_sync", value: summary, updated_at: now.toISOString() });
  return summary;
}
