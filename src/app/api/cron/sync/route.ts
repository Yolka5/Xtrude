import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeClient } from "../../../../../scripts/lib/onshape.mjs";
import { rebuildSessions } from "../../../../../scripts/lib/sessionRebuild.mjs";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hourly Vercel Cron: ingests new microversions for documents the webhook
 * endpoint flagged dirty (`last_notified_at` newer than `last_synced_at`),
 * then rebuilds sessions/daily_stats with the still-editing tail excluded
 * (see scripts/lib/sessionRebuild.mjs) - a session only gets finalized once
 * an hour has actually passed with no new activity in it, never the moment
 * an event happens to land during this run.
 *
 * The webhook notification payload itself never carries a microversionId
 * (confirmed against Onshape's docs - onshape.model.lifecycle.changed's
 * delivery has documentId/workspaceId/elementId/versionId but no
 * microversion data), so this is the one place that actually calls back
 * into Onshape's API to learn what changed - deliberately NOT done inside
 * the webhook handler itself, both to keep that handler fast and to spend
 * at most one documenthistory call per dirty document per hour rather than
 * one per delivery (a modeling session can generate many deliveries even
 * with collapseEvents on).
 */

const MAX_ONSHAPE_CALLS = 20; // generous headroom for "documents edited in the last hour", not a real cap in practice

function unauthorized() {
  return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) return unauthorized();

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const now = new Date();
  const summary = {
    at: now.toISOString(),
    documentsChecked: 0,
    documentsSynced: 0,
    eventsWritten: 0,
    errors: [] as string[],
    rebuild: null as unknown,
  };

  const { data: dirtyDocs, error: dirtyErr } = await supabase
    .from("tracked_documents")
    .select("id, onshape_document_id, onshape_workspace_id, name, last_notified_at, last_synced_at")
    .not("last_notified_at", "is", null);
  if (dirtyErr) {
    return NextResponse.json({ ok: false, reason: "load_failed", message: dirtyErr.message }, { status: 500 });
  }

  const toSync = (dirtyDocs ?? []).filter(
    (d) => !d.last_synced_at || new Date(d.last_notified_at as string) > new Date(d.last_synced_at as string)
  );
  summary.documentsChecked = toSync.length;

  if (toSync.length > 0) {
    const onshape = makeClient({
      accessKey: requireEnv("ONSHAPE_ACCESS_KEY"),
      secretKey: requireEnv("ONSHAPE_SECRET_KEY"),
      maxCalls: MAX_ONSHAPE_CALLS,
    });

    for (const doc of toSync) {
      try {
        const history = await onshape.fetchDocumentHistory(doc.onshape_document_id, doc.onshape_workspace_id);
        type EventRow = {
          document_id: string;
          element_id: string | null;
          microversion_id: string;
          occurred_at: string;
          raw: unknown;
        };
        const eventRows = history.rows
          .map((row: any): EventRow | null => {
            const microversionId = row.microversionId ?? row.id ?? row.microversion;
            const occurredAt = row.date ?? row.createdAt ?? row.time;
            if (!microversionId || !occurredAt) return null;
            return {
              document_id: doc.id,
              element_id: row.elementId ?? row.element ?? null,
              microversion_id: String(microversionId),
              occurred_at: new Date(occurredAt).toISOString(),
              raw: row,
            };
          })
          .filter((r: EventRow | null): r is EventRow => r !== null);

        if (eventRows.length > 0) {
          const { error: insertErr } = await supabase
            .from("events")
            .upsert(eventRows, { onConflict: "document_id,microversion_id", ignoreDuplicates: true });
          if (insertErr) throw new Error(`inserting events: ${insertErr.message}`);
        }

        await supabase.from("tracked_documents").update({ last_synced_at: now.toISOString() }).eq("id", doc.id);
        summary.documentsSynced++;
        summary.eventsWritten += eventRows.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${doc.name}: ${message}`);
      }
    }
  }

  try {
    summary.rebuild = await rebuildSessions(supabase, { excludeLiveTail: true, now });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`rebuildSessions: ${message}`);
  }

  await supabase.from("app_state").upsert({ key: "last_sync", value: summary, updated_at: now.toISOString() });

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
