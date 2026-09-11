/**
 * Pure session-detail assembly from DB rows. No placeholders: per-document
 * edit counts come from real events, or the document is listed without a fake 0.
 */
import { MIN_EVENTS, MIN_SPAN_MINUTES } from "../../scripts/lib/sessionAlgorithm.mjs";

export type SessionDocCount = {
  name: string;
  tab: string;
  /** Real event count for this document, or null when we only know it was touched. */
  edits: number | null;
};

export function countDocumentsFromEvents(
  events: { documentName: string | null }[]
): SessionDocCount[] {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const name = ev.documentName?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, edits]) => ({ name, tab: "", edits }));
}

export function documentsFromIds(
  ids: string[],
  nameByOnshapeId: Map<string, string>
): SessionDocCount[] {
  return ids.map((id) => ({
    name: nameByOnshapeId.get(id) ?? "Unknown document",
    tab: "",
    edits: null,
  }));
}

export function assembleSessionDocuments(opts: {
  eventNames: { documentName: string | null }[];
  documentIds: string[];
  nameByOnshapeId: Map<string, string>;
}): SessionDocCount[] {
  const counted = countDocumentsFromEvents(opts.eventNames);
  if (counted.length > 0) return counted;
  return documentsFromIds(opts.documentIds, opts.nameByOnshapeId);
}

export function sessionQualification(eventCount: number, rawMinutes: number) {
  return {
    eventCount,
    spanMinutes: rawMinutes,
    minEvents: MIN_EVENTS,
    minSpanMinutes: MIN_SPAN_MINUTES,
    qualified: eventCount >= MIN_EVENTS && rawMinutes >= MIN_SPAN_MINUTES,
  };
}
