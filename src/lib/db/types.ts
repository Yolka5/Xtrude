/** Row shapes for supabase/schema.sql. Hand-written, not generated. */

export interface UserRow {
  id: string;
  onshape_user_id: string | null;
  display_name: string;
  initials: string;
  avatar_color: string;
  created_at: string;
}

export interface TrackedDocumentRow {
  id: string;
  user_id: string;
  onshape_document_id: string;
  onshape_workspace_id: string;
  name: string;
  last_backfilled_at: string | null;
  last_notified_at: string | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  user_id: string;
  document_id: string;
  element_id: string | null;
  microversion_id: string;
  occurred_at: string;
  raw: unknown;
  created_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  event_count: number;
  raw_minutes: number;
  scored_minutes: number;
  document_ids: string[];
  created_at: string;
}

export interface DailyStatRow {
  user_id: string;
  date: string;
  total_scored_minutes: number;
  session_count: number;
}
