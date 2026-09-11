import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/client";
import { APP_USER_ID } from "../../../../../scripts/lib/appUser.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public endpoint Onshape POSTs webhook notifications to. This is the one
 * place in the app that accepts unauthenticated input from the internet,
 * so the rule is simple and absolute: never trust a delivery just because
 * it looks like one. A delivery is accepted only if its `webhookId` matches
 * a row we ourselves wrote to `webhook_registrations` (via scripts/webhooks.mjs
 * or the discovery cron) - anything else, including a well-formed payload
 * with a webhookId we don't recognize, is rejected. Every attempt, accepted
 * or not, is logged to `webhook_deliveries` - see /admin.
 *
 * Deliberately does no Onshape API calls itself (no documenthistory fetch,
 * no lookups) - it only reads/writes our own Supabase tables, so it stays
 * fast and never risks the annual Onshape call budget on a per-delivery
 * basis. It just timestamps `tracked_documents.last_notified_at`; /api/sync
 * (Today page load) and /api/cron/sync (GitHub Actions hourly) do the
 * actual Onshape read.
 *
 * Onshape's own lifecycle events (webhook.register / webhook.ping /
 * webhook.unregister) arrive here too, as validation - accepted and logged,
 * but never treated as a model change.
 */

const LIFECYCLE_EVENTS = new Set(["webhook.register", "webhook.ping", "webhook.unregister"]);
const RATE_LIMIT_WINDOW_SECONDS = 10;
const RATE_LIMIT_MAX = 40;

async function logDelivery(params: {
  webhookId: string | null;
  event: string | null;
  documentId: string | null;
  accepted: boolean;
  reason: string;
  raw: unknown;
  ip: string | null;
}) {
  const { error } = await getSupabase().from("webhook_deliveries").insert({
    user_id: APP_USER_ID,
    onshape_webhook_id: params.webhookId,
    event: params.event,
    document_id: params.documentId,
    accepted: params.accepted,
    reason: params.reason,
    raw: params.raw ?? null,
    ip: params.ip,
  });
  // Logging failure must never crash the handler - Onshape doesn't care why
  // we 500'd, it just backs off future deliveries. Worst case, this one
  // delivery is unlogged; console.error still gets it into Vercel's logs.
  if (error) console.error("webhook_deliveries insert failed:", error.message);
}

function reject(status: number, reason: string) {
  return NextResponse.json({ ok: false, reason }, { status });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    await logDelivery({ webhookId: null, event: null, documentId: null, accepted: false, reason: "invalid_json", raw: null, ip });
    return reject(400, "invalid_json");
  }

  const webhookId: string | null = typeof payload?.webhookId === "string" ? payload.webhookId : null;
  const event: string | null = typeof payload?.event === "string" ? payload.event : null;

  // Rate limit first, before any lookup - a flood shouldn't get to spend a
  // registration-table read per request. Durable across cold starts because
  // it's backed by the table we're already writing to, not in-memory state.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const { count: recentCount, error: countErr } = await getSupabase()
    .from("webhook_deliveries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", APP_USER_ID)
    .gte("received_at", since);
  if (!countErr && (recentCount ?? 0) >= RATE_LIMIT_MAX) {
    await logDelivery({ webhookId, event, documentId: null, accepted: false, reason: "rate_limited", raw: payload, ip });
    return reject(429, "rate_limited");
  }

  if (!webhookId) {
    await logDelivery({ webhookId, event, documentId: null, accepted: false, reason: "missing_webhook_id", raw: payload, ip });
    return reject(400, "missing_webhook_id");
  }

  const { data: registration, error: regErr } = await getSupabase()
    .from("webhook_registrations")
    .select("id, document_id, events, active, user_id")
    .eq("onshape_webhook_id", webhookId)
    .eq("user_id", APP_USER_ID)
    .eq("active", true)
    .maybeSingle();

  if (regErr) {
    console.error("webhook_registrations lookup failed:", regErr.message);
    await logDelivery({ webhookId, event, documentId: null, accepted: false, reason: "lookup_error", raw: payload, ip });
    return reject(500, "lookup_error");
  }

  if (!registration) {
    // Not ours - either a stale/unregistered webhookId, or someone probing
    // the endpoint. Reject and log; never write to events/tracked_documents
    // for a webhookId we can't attribute to a registration we made.
    await logDelivery({ webhookId, event, documentId: null, accepted: false, reason: "unknown_webhook_id", raw: payload, ip });
    return reject(403, "unknown_webhook_id");
  }

  if (event && LIFECYCLE_EVENTS.has(event)) {
    // Onshape's own registration/ping/unregister validation calls - proof
    // the endpoint is reachable and the registration is alive, not a model
    // change. Accepted and logged, no further action.
    await logDelivery({
      webhookId,
      event,
      documentId: registration.document_id,
      accepted: true,
      reason: "lifecycle_ack",
      raw: payload,
      ip,
    });
    return NextResponse.json({ ok: true });
  }

  if (!event || !(registration.events as string[]).includes(event)) {
    // Defense in depth: Onshape should only ever send us event types we
    // registered for on this webhookId, but don't trust that blindly either.
    await logDelivery({
      webhookId,
      event,
      documentId: registration.document_id,
      accepted: false,
      reason: "unregistered_event_type",
      raw: payload,
      ip,
    });
    return reject(400, "unregistered_event_type");
  }

  // A real model-change notification for a document we track, on a webhook
  // we registered. Mark it dirty for the hourly sync cron and accept.
  const { error: touchErr } = await getSupabase()
    .from("tracked_documents")
    .update({ last_notified_at: new Date().toISOString() })
    .eq("id", registration.document_id)
    .eq("user_id", registration.user_id);
  if (touchErr) console.error("tracked_documents touch failed:", touchErr.message);

  await logDelivery({
    webhookId,
    event,
    documentId: registration.document_id,
    accepted: true,
    reason: "ok",
    raw: payload,
    ip,
  });
  return NextResponse.json({ ok: true });
}
