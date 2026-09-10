/**
 * Onshape API client for the one-time backfill. Not used by the running
 * app - Phase 1 is backfill-only, no live updates, so nothing here runs at
 * request time.
 *
 * Every call goes through `get()`, which increments a shared counter so the
 * caller can enforce the 150-call backfill budget and print a running total.
 */

const BASE_URL = "https://cad.onshape.com/api";

export function makeClient({ accessKey, secretKey, maxCalls }) {
  const token = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
  const headers = {
    Authorization: `Basic ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let calls = 0;

  async function get(path, params = {}) {
    if (calls >= maxCalls) {
      throw new Error(
        `Hit the ${maxCalls}-call backfill budget before finishing ${path}. ` +
          `Stopping here rather than risking the annual quota - rerun later ` +
          `to continue (already-fetched events are safely stored).`
      );
    }
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    calls++;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 401 || res.status === 403
          ? "\n  401/403 usually means bad keys, or keys missing read scope on documents."
          : "";
      throw new Error(
        `HTTP ${res.status} from ${url}\n  ${body.slice(0, 2000)}${hint}\n  (4xx/5xx do not count against the annual API quota.)`
      );
    }
    return res.json();
  }

  return {
    get,
    callsUsed: () => calls,

    async whoAmI() {
      return get("/v6/users/sessioninfo");
    },

    /**
     * Lists documents owned by the authenticated user. `filter=0` is
     * Onshape's "My Documents" filter (matches the default tab in the
     * Onshape web UI) - verify this against the printed names on a dry
     * run before trusting it for a real backfill; override with
     * ONSHAPE_DOCUMENT_FILTER if it turns out wrong for this account.
     */
    async listMyDocuments() {
      const filter = process.env.ONSHAPE_DOCUMENT_FILTER ?? "0";
      const PAGE_SIZE = 100;
      const docs = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const payload = await get("/v6/documents", { filter, offset, limit: PAGE_SIZE });
        const items = Array.isArray(payload) ? payload : payload.items ?? [];
        docs.push(...items);
        if (items.length < PAGE_SIZE) break;
      }
      return docs;
    },

    /** Falls back to a workspaces call only if the document listing didn't
     * already include `defaultWorkspace` - saves a call per document in the
     * common case. */
    async getDefaultWorkspaceId(doc) {
      if (doc.defaultWorkspace?.id) return doc.defaultWorkspace.id;
      const workspaces = await get(`/v6/documents/d/${doc.id}/workspaces`);
      const list = Array.isArray(workspaces) ? workspaces : [];
      const main = list.find((w) => !w.isReadOnly) ?? list[0];
      if (!main) throw new Error(`Document ${doc.id} (${doc.name}) has no workspace.`);
      return main.id;
    },

    /**
     * Pages through documenthistory for one document/workspace, oldest and
     * newest order both handled defensively since the API's own ordering
     * isn't documented reliably enough to bet quota on: after the first
     * page we check whether timestamps are descending (newest-first, the
     * common case for an audit log) and if so stop early once a page's
     * oldest row crosses `cutoffDate`. If the order looks ascending or
     * mixed, we fall back to a hard page ceiling instead of guessing.
     *
     * Returns { rows, pages, truncatedByCutoff, truncatedBySafetyCap }.
     */
    async fetchDocumentHistory(documentId, workspaceId, { cutoffDate, maxPagesSafety = 30 } = {}) {
      const PAGE_SIZE = 100;
      const path = `/v6/documents/d/${documentId}/w/${workspaceId}/documenthistory`;
      const seen = new Set();
      const rows = [];
      let pages = 0;
      let truncatedByCutoff = false;
      let truncatedBySafetyCap = false;
      let orderKnownDescending = null;

      for (let page = 0; ; page++) {
        const offset = page * PAGE_SIZE;
        const payload = await get(path, { offset, limit: PAGE_SIZE });
        pages++;
        const items = extractRows(payload);
        if (items.length === 0) break;

        let newOnPage = 0;
        for (const row of items) {
          const mvId = row.microversionId ?? row.id ?? row.microversion;
          const key = mvId ?? `${row.date}|${row.userId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          newOnPage++;
          rows.push(row);
        }
        if (newOnPage === 0) break; // endpoint ignoring offset - stop rather than loop forever

        if (orderKnownDescending === null && items.length >= 2) {
          const first = new Date(items[0].date).getTime();
          const last = new Date(items[items.length - 1].date).getTime();
          orderKnownDescending = first > last;
        }

        if (orderKnownDescending && cutoffDate) {
          const oldestOnPage = items.reduce(
            (min, r) => Math.min(min, new Date(r.date).getTime()),
            Infinity
          );
          if (oldestOnPage < cutoffDate.getTime()) {
            truncatedByCutoff = true;
            break;
          }
        }

        if (items.length < PAGE_SIZE) break;
        if (page + 1 >= maxPagesSafety) {
          truncatedBySafetyCap = true;
          break;
        }
      }

      let filtered = rows;
      if (cutoffDate) {
        filtered = rows.filter((r) => new Date(r.date).getTime() >= cutoffDate.getTime());
      }

      return { rows: filtered, pages, truncatedByCutoff, truncatedBySafetyCap };
    },
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["items", "history", "microversions", "value"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}
