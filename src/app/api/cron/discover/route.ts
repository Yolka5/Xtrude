import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeClient } from "../../../../../scripts/lib/onshape.mjs";
import { requireEnv } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Daily Vercel Cron: the only way a document created after the last wipe
 * ever gets watched. Onshape webhooks are registered per documentId, so a
 * brand-new document has no registration until something explicitly finds
 * it and calls createWebhook for it - this is that something.
 *
 * Deliberately does NOT pull any history for a newly-discovered document
 * (no documenthistory call, no backfilled events) - "Xtrude tracks from the
 * day you connect it" applies here too: a document is connected the moment
 * this job finds it and registers its webhook, and everything from that
 * point on arrives live. Budgeted to stay near 1 Onshape call/day in the
 * steady state (just listMyDocuments) - each newly discovered document adds
 * up to 2 more (workspace lookup + webhook registration), capped by
 * MAX_ONSHAPE_CALLS so a large batch of new documents spreads across
 * several days rather than spending the run's whole budget at once.
 */

const EVENTS = [
  "onshape.model.lifecycle.changed",
  "onshape.model.lifecycle.createversion",
  "onshape.model.lifecycle.createelement",
  "onshape.model.lifecycle.deleteelement",
];
const MAX_ONSHAPE_CALLS = 10;

function unauthorized() {
  return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) return unauthorized();

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
    webhooksRegistered: 0,
    errors: [] as string[],
    callsUsed: 0,
  };

  try {
    const { docs } = await onshape.listMyDocuments();
    summary.documentsSeen = docs.length;

    const { data: existingDocs, error: existingErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id");
    if (existingErr) throw new Error(`loading tracked_documents: ${existingErr.message}`);
    const knownIds = new Set((existingDocs ?? []).map((d) => d.onshape_document_id));

    for (const doc of docs) {
      if (knownIds.has(doc.id)) continue;
      try {
        const workspaceId = await onshape.getDefaultWorkspaceId(doc);
        const { data: inserted, error: insertErr } = await supabase
          .from("tracked_documents")
          .insert({ onshape_document_id: doc.id, onshape_workspace_id: workspaceId, name: doc.name })
          .select()
          .single();
        if (insertErr) throw new Error(`inserting tracked_documents: ${insertErr.message}`);
        summary.documentsAdded++;
        knownIds.add(doc.id);
        // Fall through to the registration pass below by treating it like
        // any other document missing a registration.
        void inserted;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        summary.errors.push(`discover ${doc.name}: ${message}`);
      }
    }

    const { data: allDocs, error: allErr } = await supabase
      .from("tracked_documents")
      .select("id, onshape_document_id, name");
    if (allErr) throw new Error(`reloading tracked_documents: ${allErr.message}`);

    const { data: activeRegs, error: regErr } = await supabase
      .from("webhook_registrations")
      .select("document_id")
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
        const { error: regInsertErr } = await supabase
          .from("webhook_registrations")
          .insert({ onshape_webhook_id: info.id, document_id: doc.id, events: EVENTS, active: true });
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
  await supabase.from("app_state").upsert({ key: "last_discovery", value: summary, updated_at: now.toISOString() });

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}
