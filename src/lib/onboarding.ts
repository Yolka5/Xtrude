import "server-only";
import { makeClient, rebuildSessions } from "@/lib/onshapeRuntime";
import { ingestDocumentHistory } from "../../scripts/lib/ingestDocument.mjs";
import { loadOnshapeUserId } from "../../scripts/lib/userScope.mjs";
import { getSupabase } from "@/lib/db/client";
import { getValidAccessToken } from "@/lib/auth/tokens";
import { requireEnv } from "@/lib/env";
import { DISCOVERY_EVENTS, stampUserDiscovered } from "@/lib/discoverDocuments";
import { maxCallsPerRun } from "../../scripts/lib/callBudget.mjs";

const EVENTS = DISCOVERY_EVENTS;

export const ONBOARD_MAX_DOCS = 20;
/** list(1) + up to 20 workspace + 20 history + 20 webhook = 61. Padding for retries. */
export const ONBOARD_MAX_CALLS = 65;

export const ONBOARD_API_COST = {
  typical: 41,
  worst: 61,
  breakdown:
    "1 listMyDocuments (20 most recently modified) + up to 20 workspace lookups (0 when defaultWorkspace is on the list payload) + 20 documenthistory + 20 createWebhook. Deliveries after that are free. 4xx/5xx do not count against the annual quota.",
};

export type OnboardSummary = {
  documentsAdded: number;
  historiesPulled: number;
  eventsWritten: number;
  webhooksRegistered: number;
  callsUsed: number;
  errors: string[];
};

/**
 * First-run setup for a user who has no tracked documents yet.
 * Do not call this against a live Onshape account from this session —
 * it spends tens of quota-counted API calls.
 */
export async function onboardUser(userId: string): Promise<OnboardSummary> {
  const summary: OnboardSummary = {
    documentsAdded: 0,
    historiesPulled: 0,
    eventsWritten: 0,
    webhooksRegistered: 0,
    callsUsed: 0,
    errors: [],
  };

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    summary.errors.push("no_oauth_token");
    return summary;
  }

  const webhookUrl = requireEnv("WEBHOOK_URL");
  const supabase = getSupabase();
  const authorOnshapeId = await loadOnshapeUserId(supabase, userId);
  const onshape = makeClient({ accessToken, maxCalls: Math.min(ONBOARD_MAX_CALLS, maxCallsPerRun()) });
  const now = new Date();

  const { docs } = await onshape.listMyDocuments(ONBOARD_MAX_DOCS);

  for (const doc of docs) {
    try {
      const workspaceId = await onshape.getDefaultWorkspaceId(doc);
      const { data: inserted, error: insertErr } = await supabase
        .from("tracked_documents")
        .insert({
          user_id: userId,
          onshape_document_id: doc.id,
          onshape_workspace_id: workspaceId,
          name: doc.name ?? "Untitled",
        })
        .select("id, onshape_document_id, onshape_workspace_id, user_id")
        .single();
      if (insertErr) throw new Error(insertErr.message);
      summary.documentsAdded++;

      const ingested = await ingestDocumentHistory(supabase, onshape, inserted, { markBackfilled: true, now, authorOnshapeId });
      summary.historiesPulled++;
      summary.eventsWritten += ingested.eventsWritten;

      const info = await onshape.registerWebhook({
        documentId: doc.id,
        events: EVENTS,
        url: webhookUrl,
      });
      const { error: regErr } = await supabase.from("webhook_registrations").upsert(
        {
          user_id: userId,
          onshape_webhook_id: info.id,
          document_id: inserted.id,
          events: EVENTS,
          active: true,
          unregistered_at: null,
        },
        { onConflict: "document_id" }
      );
      if (regErr) {
        await onshape.unregisterWebhook(info.id).catch(() => {});
        throw new Error(regErr.message);
      }
      summary.webhooksRegistered++;
    } catch (err) {
      summary.errors.push(`${doc.name ?? doc.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  try {
    await rebuildSessions(supabase, { excludeLiveTail: true, now, userId });
  } catch (err) {
    summary.errors.push(`rebuild: ${err instanceof Error ? err.message : String(err)}`);
  }

  summary.callsUsed = onshape.callsUsed();
  await stampUserDiscovered(supabase, userId, now, { source: "onboard" });
  return summary;
}

export async function maybeOnboardUser(userId: string): Promise<OnboardSummary | null> {
  const { count, error } = await getSupabase()
    .from("tracked_documents")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.error("onboard count failed:", error.message);
    return null;
  }
  if ((count ?? 0) > 0) return null;
  return onboardUser(userId);
}
