import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeClient } from "../../../../../scripts/lib/onshape.mjs";
import { ingestDocumentHistory } from "../../../../../scripts/lib/ingestDocument.mjs";
import { rebuildSessions } from "../../../../../scripts/lib/sessionRebuild.mjs";
import { snapshotStreak } from "../../../../../scripts/lib/streakSnapshot.mjs";
import { requireEnv } from "@/lib/env";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";
import { APP_USER_ID } from "../../../../../scripts/lib/appUser.mjs";
import { maybeSendPushReminders } from "@/lib/push/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily Vercel Cron (22:00 UTC = midnight IST / 01:00 IDT): the only way a
 * document created after the last wipe ever gets watched. Onshape webhooks
 * are registered per documentId, so a brand-new document has no
 * registration until something finds it and calls createWebhook.
 *
 * On first discovery of a document this job has never seen, it also pulls
 * that document's history and ingests it (one documenthistory call).
 * Webhooks only fire after registration, so any modelling done between
 * "document created" and "this job found it" would otherwise be lost.
 * `last_backfilled_at` records that the pull happened; a later run will
 * not re-pull.
 *
 * The same run rebuilds sessions/daily_stats and snapshots streak state
 * so a missed day breaks the streak at midnight even if nobody opens the
 * app.
 *
 * Steady state: 1 Onshape call (listMyDocuments). Each newly discovered
 * document adds 1 history pull + 1 webhook registration (+ 1 workspace
 * lookup only when the list payload omitted defaultWorkspace).
 */

const EVENTS = [
  "onshape.model.lifecycle.changed",
  "onshape.model.lifecycle.createversion",
  "onshape.model.lifecycle.createelement",
  "onshape.model.lifecycle.deleteelement",
];
const MAX_ONSHAPE_CALLS = 10;

async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorizedCron();

  const webhookUrl = requireEnv("WEBHOOK_URL");
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const onshape = makeClient({
    accessKey: requireEnv("ONSHAPE_ACCESS_KEY"),
    secretKey: requireEnv("ONSHAPE_SECRET_KEY"),
    maxCalls: MAX_ONSHAPE_CALLS,
  });

  const now = new Date();
  const summary = {
    at: now.toISOString(),
    documentsSeen: 0,
    documentsAdded: 0,
    documentsBackfilled: 0,
    backfillEventsWritten: 0,
    webhooksRegistered: 0,
    errors: [] as string[],
    callsUsed: 0,
    rollup: null as unknown,
    streak: null as unknown,
  };

  try {
    const { docs } = await onshape.listMyDocuments();
    summary.documentsSeen = docs.length;

    const { data: existingDocs, error: existingErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id")
      .eq("user_id", APP_USER_ID);
    if (existingErr) throw new Error(`loading tracked_documents: ${existingErr.message}`);
    const knownIds = new Set((existingDocs ?? []).map((d) => d.onshape_document_id));

    for (const doc of docs) {
      if (knownIds.has(doc.id)) continue;
      try {
        const workspaceId = await onshape.getDefaultWorkspaceId(doc);
        const { data: inserted, error: insertErr } = await supabase
          .from("tracked_documents")
          .insert({
            user_id: APP_USER_ID,
            onshape_document_id: doc.id,
            onshape_workspace_id: workspaceId,
            name: doc.name,
          })
          .select()
          .single();
        if (insertErr) throw new Error(`inserting tracked_documents: ${insertErr.message}`);
        summary.documentsAdded++;
        knownIds.add(doc.id);
        void inserted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`discover ${doc.name}: ${message}`);
      }
    }

    // First-seen documents only: last_backfilled_at is null. Existing
    // tracked docs from the original seed already have this set, so a
    // re-run cannot re-pull their (truncated-at-50) history.
    const { data: needsBackfill, error: backfillErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id, onshape_workspace_id, name, user_id")
      .eq("user_id", APP_USER_ID)
      .is("last_backfilled_at", null);
    if (backfillErr) throw new Error(`loading un-backfilled documents: ${backfillErr.message}`);

    for (const doc of needsBackfill ?? []) {
      if (onshape.callsUsed() >= MAX_ONSHAPE_CALLS) {
        summary.errors.push(`${doc.name}: first-history skipped, call budget reached this run - will retry tomorrow.`);
        continue;
      }
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
      .eq("user_id", APP_USER_ID);
    if (allErr) throw new Error(`reloading tracked_documents: ${allErr.message}`);

    const { data: activeRegs, error: regErr } = await supabase
      .from("webhook_registrations")
      .select("document_id")
      .eq("user_id", APP_USER_ID)
      .eq("active", true);
    if (regErr) throw new Error(`loading webhook_registrations: ${regErr.message}`);
    const registered = new Set((activeRegs ?? []).map((r) => r.document_id));

    for (const doc of allDocs ?? []) {
      if (registered.has(doc.id)) continue;
      if (onshape.callsUsed() >= MAX_ONSHAPE_CALLS) {
        summary.errors.push(`${doc.name}: skipped, call budget reached this run - will retry tomorrow.`);
        continue;
      }
      try {
        const info = await onshape.registerWebhook({ documentId: doc.onshape_document_id, events: EVENTS, url: webhookUrl });
        const { error: regInsertErr } = await supabase.from("webhook_registrations").upsert(
          {
            user_id: APP_USER_ID,
            onshape_webhook_id: info.id,
            document_id: doc.id,
            events: EVENTS,
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

  try {
    summary.rollup = await rebuildSessions(supabase, { excludeLiveTail: true, now });
    summary.streak = await snapshotStreak(supabase, now);
    await supabase.from("app_state").upsert({
      key: "last_rollup",
      value: { rollup: summary.rollup, streak: summary.streak },
      updated_at: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`rollup: ${message}`);
  }

  summary.callsUsed = onshape.callsUsed();
  try {
    (summary as { push?: unknown }).push = await maybeSendPushReminders(now);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`push: ${message}`);
  }
  await supabase.from("app_state").upsert({ key: "last_discovery", value: summary, updated_at: now.toISOString() });

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
