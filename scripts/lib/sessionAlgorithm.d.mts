export declare const IDLE_THRESHOLD_MINUTES: number;
export declare const LEAD_IN_MINUTES: number;
export declare const MAX_SESSION_HOURS: number;
export declare const MIN_EVENTS: number;
export declare const MIN_SPAN_MINUTES: number;

export interface ClusterEvent {
  occurred_at: string;
  document_id: string;
}

export interface Cluster {
  startedAt: string;
  endedAt: string;
  spanSeconds: number;
  durationSeconds: number;
  eventCount: number;
  clamped: boolean;
  kept: boolean;
  documentIds: string[];
}

export declare function clusterSessions(events: ClusterEvent[]): Cluster[];
