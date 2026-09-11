#!/usr/bin/env node
/**
 * Webhook management CLI: register, list, unregister. Onshape does not
 * deduplicate registration calls - calling createWebhook twice for the same
 * document means every future edit arrives as two deliveries - so `register`
 * always checks `webhook_registrations` first and only registers documents
 * that don't already have an active one there. One webhook per document
 * covers every event in EVENTS (Onshape's `events` field takes an array).
 *
 * Needs a publicly reachable WEBHOOK_URL - Onshape calls this URL from the
 * internet, so this only works pointed at the deployed Vercel app, never at
 * localhost.
 *
 * Run:
 *   npm run webhooks -- register            # all tracked docs missing one
 *   npm run webhooks -- register <docId>    # just one (onshape_document_id)
 *   npm run webhooks -- list
 *   npm run webhooks -- unregister <onshapeWebhookId>
 *   npm run webhooks -- unregister --all
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { makeClient } from "./lib/onshape.mjs";
import { createClient } from "@supabase/supabase-js";
import { APP_USER_ID } from "./lib/appUser.mjs";

loadEnv();

const EVENTS = [
  "onshape.model.lifecycle.changed",
  "onshape.model.lifecycle.createversion",
  "onshape.model.lifecycle.createelement",
  "onshape.model.lifecycle.deleteelement",
];

function section(title) {
  console.log();
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

function makeOnshape() {
  const accessKey = requireEnv("ONSHAPE_ACCESS_KEY");
  const secretKey = requireEnv("ONSHAPE_SECRET_KEY");
  return makeClient({ accessKey, secretKey, maxCalls: Number(process.env.WEBHOOK_MAX_CALLS ?? 30) });
}

function makeSupabase() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
}

async function cmdRegister(onlyDocumentId) {
  const webhookUrl = requireEnv("WEBHOOK_URL");
  if (!webhookUrl.startsWith("https://")) {
    throw new Error(`WEBHOOK_URL must be a public https:// URL - Onshape can't reach ${webhookUrl}.`);
  }
  const onshape = makeOnshape();
  const supabase = makeSupabase();

  section("1. TRACKED DOCUMENTS");
  let query = supabase.from("tracked_documents").select("id, onshape_document_id, onshape_workspace_id, name").eq("user_id", APP_USER_ID);
  if (onlyDocumentId) query = query.eq("onshape_document_id", onlyDocumentId);
  const { data: docs, error: docsErr } = await query;
  if (docsErr) throw new Error(`loading tracked_documents: ${docsErr.message}`);
  if (!docs || docs.length === 0) {
    console.log(onlyDocumentId ? `No tracked document with id ${onlyDocumentId}.` : "No tracked documents.");
    return;
  }
  console.log(`${docs.length} tracked document(s).`);

  section("2. EXISTING REGISTRATIONS");
  const { data: existing, error: existingErr } = await supabase
    .from("webhook_registrations")
    .select("document_id")
    .eq("user_id", APP_USER_ID)
    .eq("active", true);
  if (existingErr) throw new Error(`loading webhook_registrations: ${existingErr.message}`);
  const alreadyRegistered = new Set((existing ?? []).map((r) => r.document_id));
  console.log(`${alreadyRegistered.size} document(s) already have an active registration.`);

  section("3. REGISTER");
  let registered = 0;
  for (const doc of docs) {
    if (alreadyRegistered.has(doc.id)) {
      console.log(`  ${doc.name}: already registered, skipping.`);
      continue;
    }
    console.log(`  ${doc.name} (${doc.onshape_document_id}): registering...`);
    const info = await onshape.registerWebhook({ documentId: doc.onshape_document_id, events: EVENTS, url: webhookUrl });
    const { error: insertErr } = await supabase.from("webhook_registrations").upsert(
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
    if (insertErr) {
      // The Onshape-side registration now exists but we failed to record it -
      // leaving it live would mean it's untracked and every future delivery
      // gets rejected as unknown_webhook_id. Best effort: unregister it again
      // rather than leaving an orphan.
      console.log(`  FAILED to save registration (${insertErr.message}) - rolling back on Onshape's side...`);
      await onshape.unregisterWebhook(info.id).catch((e) => console.log(`  rollback also failed: ${e.message}`));
      continue;
    }
    console.log(`  -> webhookId ${info.id}`);
    registered++;
  }

  section("4. SUMMARY");
  console.log(`registered   : ${registered}`);
  console.log(`skipped      : ${docs.length - registered}`);
  console.log(`API calls used: ${onshape.callsUsed()}`);
}

async function cmdList() {
  const supabase = makeSupabase();
  const { data, error } = await supabase
    .from("webhook_registrations")
    .select("onshape_webhook_id, events, active, created_at, unregistered_at, tracked_documents(name, onshape_document_id)")
    .eq("user_id", APP_USER_ID)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`loading webhook_registrations: ${error.message}`);
  if (!data || data.length === 0) {
    console.log("No webhook registrations recorded.");
    return;
  }
  for (const r of data) {
    const doc = r.tracked_documents;
    console.log();
    console.log(`webhookId : ${r.onshape_webhook_id}`);
    console.log(`document  : ${doc?.name ?? "?"} (${doc?.onshape_document_id ?? "?"})`);
    console.log(`events    : ${r.events.join(", ")}`);
    console.log(`status    : ${r.active ? "active" : `inactive (unregistered ${r.unregistered_at})`}`);
    console.log(`created   : ${r.created_at}`);
  }
}

async function cmdUnregister(target) {
  const onshape = makeOnshape();
  const supabase = makeSupabase();

  let rows;
  if (target === "--all") {
    const { data, error } = await supabase.from("webhook_registrations").select("onshape_webhook_id").eq("user_id", APP_USER_ID).eq("active", true);
    if (error) throw new Error(error.message);
    rows = data ?? [];
  } else {
    rows = [{ onshape_webhook_id: target }];
  }

  for (const row of rows) {
    console.log(`Unregistering ${row.onshape_webhook_id}...`);
    try {
      await onshape.unregisterWebhook(row.onshape_webhook_id);
    } catch (err) {
      console.log(`  Onshape-side unregister failed (${err.message}) - marking inactive locally anyway.`);
    }
    const { error } = await supabase
      .from("webhook_registrations")
      .update({ active: false, unregistered_at: new Date().toISOString() })
      .eq("user_id", APP_USER_ID)
      .eq("onshape_webhook_id", row.onshape_webhook_id);
    if (error) console.log(`  FAILED updating local record: ${error.message}`);
  }
  console.log(`Done. ${rows.length} webhook(s) processed. API calls used: ${onshape.callsUsed()}`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "register") return cmdRegister(arg);
  if (cmd === "list") return cmdList();
  if (cmd === "unregister") {
    if (!arg) throw new Error("Usage: npm run webhooks -- unregister <onshapeWebhookId>|--all");
    return cmdUnregister(arg);
  }
  console.log("Usage:");
  console.log("  npm run webhooks -- register [onshapeDocumentId]");
  console.log("  npm run webhooks -- list");
  console.log("  npm run webhooks -- unregister <onshapeWebhookId>|--all");
  process.exit(1);
}

main().catch((err) => {
  console.error("\nwebhooks command failed:", err.message);
  process.exit(1);
});
