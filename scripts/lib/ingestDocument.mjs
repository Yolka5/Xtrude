/**
 * One documenthistory pull → `events` upsert. Used by the dirty-document
 * sync (page load + GitHub Actions) and by first-discovery backfill.
 *
 * Costs exactly one Onshape API call (`fetchDocumentHistory`). The 50-row
 * ceiling still applies, but a brand-new document is well under that, so
 * first discovery recovers the whole pre-webhook history.
 */
export function eventRowsFromHistory(documentId, history) {
  return (history.rows ?? [])
    .map((row) => {
      const microversionId = row.microversionId ?? row.id ?? row.microversion;
      const occurredAt = row.date ?? row.createdAt ?? row.time;
      if (!microversionId || !occurredAt) return null;
      return {
        document_id: documentId,
        element_id: row.elementId ?? row.element ?? null,
        microversion_id: String(microversionId),
        occurred_at: new Date(occurredAt).toISOString(),
        raw: row,
      };
    })
    .filter(Boolean);
}

/**
 * @param {*} supabase
 * @param {*} onshape
 * @param {{ id: string, onshape_document_id: string, onshape_workspace_id: string }} doc
 * @param {{ markBackfilled?: boolean, now?: Date }} [opts]
 */
export async function ingestDocumentHistory(supabase, onshape, doc, { markBackfilled = false, now = new Date() } = {}) {
  const history = await onshape.fetchDocumentHistory(doc.onshape_document_id, doc.onshape_workspace_id);
  const eventRows = eventRowsFromHistory(doc.id, history);

  if (eventRows.length > 0) {
    const { error: insertErr } = await supabase
      .from("events")
      .upsert(eventRows, { onConflict: "document_id,microversion_id", ignoreDuplicates: true });
    if (insertErr) throw new Error(`inserting events: ${insertErr.message}`);
  }

  const patch = { last_synced_at: now.toISOString() };
  if (markBackfilled) patch.last_backfilled_at = now.toISOString();
  const { error: updateErr } = await supabase.from("tracked_documents").update(patch).eq("id", doc.id);
  if (updateErr) throw new Error(`updating tracked_documents: ${updateErr.message}`);

  return {
    eventsWritten: eventRows.length,
    possiblyTruncatedAt50: Boolean(history.possiblyTruncatedAt50),
  };
}
