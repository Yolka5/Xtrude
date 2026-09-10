#!/usr/bin/env node
/**
 * One-time backfill: pulls real Onshape document history into `events`.
 *
 * Run:
 *   npm run backfill -- --dry-run   # lists documents only, 1-2 API calls, no writes
 *   npm run backfill                # the real thing
 *
 * Quota discipline: free/EDU Onshape accounts get 2,500 API calls PER YEAR.
 * This script hard-stops at BACKFILL_MAX_CALLS (default 150) and prints a
 * running count as it goes. History older than 12 months is skipped per
 * document rather than pulled and discarded, to keep the call count down on
 * documents with a long life.
 *
 * Also bounds *which* documents get backfilled at all: BACKFILL_MAX_DOCS
 * (default 20) most-recently-modified documents, not "my documents" in
 * full. Found live that this account has 600+ documents - backfilling all
 * of them would cost 1,000+ calls, nowhere near the call budget above.
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { makeClient } from "./lib/onshape.mjs";
import { createClient } from "@supabase/supabase-js";

loadEnv();

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_CALLS = Number(process.env.BACKFILL_MAX_CALLS ?? 150);
const MAX_DOCS = Number(process.env.BACKFILL_MAX_DOCS ?? 20);
const CUTOFF_MONTHS = 12;

function rule(char = "-", width = 78) {
  console.log(char.repeat(width));
}
function section(title) {
  console.log();
  rule("=");
  console.log(title);
  rule("=");
}

async function main() {
  const accessKey = requireEnv("ONSHAPE_ACCESS_KEY");
  const secretKey = requireEnv("ONSHAPE_SECRET_KEY");
  const onshape = makeClient({ accessKey, secretKey, maxCalls: MAX_CALLS });

  section("1. AUTH");
  const who = await onshape.whoAmI();
  console.log(`Authenticated as : ${who.name ?? "?"}`);
  console.log(`Onshape user id  : ${who.id ?? "?"}`);
  console.log(`Call budget      : ${MAX_CALLS} (${onshape.callsUsed()} used so far)`);

  section("2. DOCUMENTS");
  const { docs, pages: docPages } = await onshape.listMyDocuments(MAX_DOCS);
  console.log(
    `Found ${docs.length} document(s) across ${docPages} page(s) - the ${MAX_DOCS} most recently ` +
      `modified under filter=${process.env.ONSHAPE_DOCUMENT_FILTER ?? "0"} ("my documents"), ` +
      `not the full account (this account has 600+ documents total).`
  );
  console.log();
  for (const doc of docs) {
    console.log(`  ${doc.id}  ${doc.name}`);
  }
  console.log();
  console.log(`API calls so far: ${onshape.callsUsed()}`);

  if (DRY_RUN) {
    console.log();
    console.log("Dry run - stopping here. Nothing was written. If this list");
    console.log("looks wrong (missing documents you expected, or documents");
    console.log("that aren't yours), set ONSHAPE_DOCUMENT_FILTER in .env and");
    console.log("rerun before spending real quota.");
    return;
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - CUTOFF_MONTHS);

  section("3. BACKFILL");
  console.log(`Cutoff: history before ${cutoffDate.toISOString().slice(0, 10)} is skipped per document.`);

  let totalEventsWritten = 0;
  let totalRowsFetched = 0;
  const summary = [];

  for (const doc of docs) {
    console.log();
    rule();
    console.log(`${doc.name}  (${doc.id})`);

    if (onshape.callsUsed() >= MAX_CALLS) {
      console.log("  SKIPPED - call budget already exhausted.");
      summary.push({ name: doc.name, skipped: true });
      continue;
    }

    let workspaceId;
    try {
      workspaceId = await onshape.getDefaultWorkspaceId(doc);
    } catch (err) {
      console.log(`  FAILED to get workspace: ${err.message}`);
      summary.push({ name: doc.name, failed: true });
      continue;
    }

    let history;
    try {
      history = await onshape.fetchDocumentHistory(doc.id, workspaceId, { cutoffDate });
    } catch (err) {
      console.log(`  FAILED fetching history: ${err.message}`);
      summary.push({ name: doc.name, failed: true });
      break; // most likely the budget guard tripped - no point continuing
    }

    console.log(
      `  ${history.pages} page(s), ${history.rows.length} row(s) within the ${CUTOFF_MONTHS}-month window` +
        (history.possiblyTruncatedAt50
          ? " - WARNING: exactly 50 rows, documenthistory's hard per-call cap. This document" +
            " likely has more history than we can currently reach (see onshape.mjs's" +
            " fetchDocumentHistory comment); accepted as a known Phase 1 limit."
          : "")
    );
    totalRowsFetched += history.rows.length;
    console.log(`  API calls so far: ${onshape.callsUsed()} / ${MAX_CALLS}`);

    // Upsert the tracked_documents row first so events can reference its
    // internal id via a foreign key.
    const { data: trackedDoc, error: trackedErr } = await supabase
      .from("tracked_documents")
      .upsert(
        {
          onshape_document_id: doc.id,
          onshape_workspace_id: workspaceId,
          name: doc.name,
          last_backfilled_at: new Date().toISOString(),
        },
        { onConflict: "onshape_document_id" }
      )
      .select()
      .single();

    if (trackedErr) {
      console.log(`  FAILED writing tracked_documents: ${trackedErr.message}`);
      summary.push({ name: doc.name, failed: true });
      continue;
    }

    const eventRows = history.rows
      .map((row) => {
        const microversionId = row.microversionId ?? row.id ?? row.microversion;
        const occurredAt = row.date ?? row.createdAt ?? row.time;
        if (!microversionId || !occurredAt) return null;
        return {
          document_id: trackedDoc.id,
          element_id: row.elementId ?? row.element ?? null,
          microversion_id: String(microversionId),
          occurred_at: new Date(occurredAt).toISOString(),
          raw: row,
        };
      })
      .filter(Boolean);

    const CHUNK = 500;
    let chunkFailed = false;
    for (let i = 0; i < eventRows.length; i += CHUNK) {
      const chunk = eventRows.slice(i, i + CHUNK);
      const { error: insertErr } = await supabase
        .from("events")
        .upsert(chunk, { onConflict: "document_id,microversion_id", ignoreDuplicates: true });
      if (insertErr) {
        console.log(`  FAILED writing events (chunk ${i}): ${insertErr.message}`);
        chunkFailed = true;
        break;
      }
    }

    // Ask Postgres for the authoritative total rather than trying to infer
    // "how many were actually new" from the upsert response - simpler, and
    // exactly right whether this is a first run or a rerun over old ground.
    const { count: totalForDoc } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("document_id", trackedDoc.id);

    console.log(
      `  events table now has ${totalForDoc ?? "?"} row(s) for this document ` +
        `(${eventRows.length} row(s) from this run's fetch, duplicates from any earlier run silently skipped)`
    );
    if (chunkFailed) {
      summary.push({ name: doc.name, failed: true });
      continue;
    }
    totalEventsWritten += totalForDoc ?? 0;
    summary.push({ name: doc.name, rows: history.rows.length, totalInDb: totalForDoc ?? 0 });
  }

  section("4. SUMMARY");
  for (const s of summary) {
    if (s.skipped) console.log(`  ${s.name}: skipped (budget exhausted)`);
    else if (s.failed) console.log(`  ${s.name}: failed`);
    else console.log(`  ${s.name}: ${s.rows} row(s) fetched this run, ${s.totalInDb} event(s) now in the DB for it`);
  }
  console.log();
  console.log(`Total API calls used : ${onshape.callsUsed()} (budget was ${MAX_CALLS})`);
  console.log(`Total rows fetched   : ${totalRowsFetched}`);
  console.log(`Total events in DB   : ${totalEventsWritten} (across the documents processed this run)`);
  console.log();
  console.log("Next: npm run recompute-sessions");
}

main().catch((err) => {
  console.error("\nBackfill failed:", err.message);
  process.exit(1);
});
