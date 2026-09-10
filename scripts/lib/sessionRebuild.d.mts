export interface RebuildResult {
  eventCount: number;
  clusterCount: number;
  kept: number;
  dropped: number;
  excludedLiveTail: boolean;
  sessionsWritten: number;
  activeDays: number;
  totalScoredMinutes: number;
}

export declare function rebuildSessions(
  supabase: unknown,
  opts?: { excludeLiveTail?: boolean; now?: Date }
): Promise<RebuildResult>;
