/** Today page-load sync: if last_sync is older than this, fire /api/sync
 * in the background. Server and client both honor the same window so a
 * burst of tab switches cannot spend Onshape calls. */
export const PAGE_SYNC_MAX_AGE_MS = 15 * 60 * 1000;
