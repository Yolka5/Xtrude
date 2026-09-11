import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestDocumentHistory } from "../../scripts/lib/ingestDocument.mjs";

export const DISCOVERY_EVENTS = [
  "onshape.model.lifecycle.changed",
  "onshape.model.lifecycle.createversion",
  "onshape.model.lifecycle.createelement",
  "onshape.model.lifecycle.deleteelement",
];

export function discoveryUserKey(userId: string): string {
  return `discovery_user_${userId}`;
}

export function lastDiscoveredAtFromValue(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const stamp = (value as { lastDiscoveredAt?: unknown }).lastDiscoveredAt;
  return typeof stamp === "string" && stamp.length > 0 ? stamp : null;
}

export type OnshapeDiscoverClient = {
  listMyDocuments: (maxDocuments?: number) => Promise<{
    docs: Array<{ id: string; name?: string; defaultWorkspace?: { id: string } }>;
  }>;
  getDefaultWorkspaceId: (doc: unknown) => Promise<string>;
  registerWebhook: (opts: { documentId: string; events: string[]; url: string }) => Promise<{ id: string }>;
  unregisterWebhook: (id: string) => Promise<unknown>;
  callsUsed: () => number;
};

export type DiscoverUserResult = {
  documentsSeen: number;
  documentsAdded: number;
  documentsBackfilled: number;
  backfillEventsWritten: number;
  webhooksRegistered: number;
  callsUsed: number;
  errors: string[];
};

export async function stampUserDiscovered(
  supabase: SupabaseClient,
  userId: string,
  now: Date,
  extra: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("app_state").upsert({
    key: discoveryUserKey(userId),
    value: { lastDiscoveredAt: now.toISOString(), ...extra },
    updated_at: now.toISOString(),
  });
}

/**
 * List this user's Onshape documents, insert unknown ones, first-history
 * backfill when last_backfilled_at is null, register missing webhooks.
 * Call budget is whatever the client was constructed with.
 */
export async function discoverForUser(
  supabase: SupabaseClient,
  onshape: OnshapeDiscoverClient,
  userId: string,
  webhookUrl: string,
  now: Date
): Promise<DiscoverUserResult> {
  const summary: DiscoverUserResult = {
    documentsSeen: 0,
    documentsAdded: 0,
    documentsBackfilled: 0,
    backfillEventsWritten: 0,
    webhooksRegistered: 0,
    callsUsed: 0,
    errors: [],
  };

  try {
    const { docs } = await onshape.listMyDocuments();
    summary.documentsSeen = docs.length;

    const { data: existingDocs, error: existingErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id")
      .eq("user_id", userId);
    if (existingErr) throw new Error(`loading tracked_documents: ${existingErr.message}`);
    const knownIds = new Set((existingDocs ?? []).map((d) => d.onshape_document_id as string));

    for (const doc of docs) {
      if (knownIds.has(doc.id)) continue;
      try {
        const workspaceId = await onshape.getDefaultWorkspaceId(doc);
        const { error: insertErr } = await supabase
          .from("tracked_documents")
          .insert({
            user_id: userId,
            onshape_document_id: doc.id,
            onshape_workspace_id: workspaceId,
            name: doc.name ?? "Untitled",
          });
        if (insertErr) throw new Error(`inserting tracked_documents: ${insertErr.message}`);
        summary.documentsAdded++;
        knownIds.add(doc.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`discover ${doc.name ?? doc.id}: ${message}`);
      }
    }

    const { data: needsBackfill, error: backfillErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id, onshape_workspace_id, name, user_id")
      .eq("user_id", userId)
      .is("last_backfilled_at", null);
    if (backfillErr) throw new Error(`loading un-backfilled documents: ${backfillErr.message}`);

    for (const doc of needsBackfill ?? []) {
      try {
        const ingested = await ingestDocumentHistory(supabase, onshape, doc, { markBackfilled: true, now });
        summary.documentsBackfilled++;
        summary.backfillEventsWritten += ingested.eventsWritten;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`backfill ${doc.name}: ${message}`);
      }
    }

    const { data: allDocs, error: allErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id, name")
      .eq("user_id", userId);
    if (allErr) throw new Error(`reloading tracked_documents: ${allErr.message}`);

    const { data: activeRegs, error: regErr } = await supabase
      .from("webhook_registrations")
      .select("document_id")
      .eq("user_id", userId)
      .eq("active", true);
    if (regErr) throw new Error(`loading webhook_registrations: ${regErr.message}`);
    const registered = new Set((activeRegs ?? []).map((r) => r.document_id as string));

    for (const doc of allDocs ?? []) {
      if (registered.has(doc.id as string)) continue;
      try {
        const info = await onshape.registerWebhook({
          documentId: doc.onshape_document_id as string,
          events: DISCOVERY_EVENTS,
          url: webhookUrl,
        });
        const { error: regInsertErr } = await supabase.from("webhook_registrations").upsert(
          {
            user_id: userId,
            onshape_webhook_id: info.id,
            document_id: doc.id,
            events: DISCOVERY_EVENTS,
            active: true,
            unregistered_at: null,
          },
          { onConflict: "document_id" }
        );
        if (regInsertErr) {
          await onshape.unregisterWebhook(info.id).catch(() => {});
          throw new Error(`saving registration: ${regInsertErr.message}`);
        }
        summary.webhooksRegistered++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`register ${doc.name}: ${message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(message);
  }

  summary.callsUsed = onshape.callsUsed();
  return summary;
}
