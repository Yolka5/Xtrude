/**
 * Onshape API client. Originally backfill-only; Phase 1b also imports this
 * (get/post/del, webhook methods) from src/app/api/cron/* routes and the
 * webhook management script - still a plain, dependency-free module, so
 * that works whether the caller is `node scripts/x.mjs` or Next's bundler.
 *
 * Every call goes through `request()`, which increments a shared counter so
 * the caller can enforce a call budget and print a running total. Registering,
 * listing, or unregistering a webhook costs a call like anything else here;
 * receiving a webhook delivery does not - Onshape is calling us, not the
 * other way round.
 */

const BASE_URL = "https://cad.onshape.com/api";

export function makeClient({ accessKey, secretKey, accessToken, maxCalls }) {
  const headers = {
    Authorization: accessToken
      ? `Bearer ${accessToken}`
      : `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  let calls = 0;

  async function request(method, path, { params = {}, body } = {}) {
    if (calls >= maxCalls) {
      throw new Error(
        `Hit the ${maxCalls}-call budget before finishing ${method} ${path}. ` +
          `Stopping here rather than risking the annual quota.`
      );
    }
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    calls++;
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      const hint =
        res.status === 401 || res.status === 403
          ? "\n  401/403 usually means bad keys, or keys missing scope for this call."
          : "";
      throw new Error(
        `HTTP ${res.status} from ${method} ${url}\n  ${responseBody.slice(0, 2000)}${hint}\n  (4xx/5xx do not count against the annual API quota.)`
      );
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const get = (path, params) => request("GET", path, { params });
  const post = (path, body) => request("POST", path, { body });
  const del = (path, params) => request("DELETE", path, { params });

  return {
    get,
    post,
    del,
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
     *
     * limit=20 is a hard server-side max on this endpoint specifically
     * (confirmed live: limit=100 gets a 400 "must be less than or equal to
     * 20") - documenthistory's own page size below is unrelated and unaffected.
     *
     * Learned the hard way (burned real quota finding this out): unlike
     * documenthistory, this endpoint does NOT reliably shrink its last page
     * below the page size to signal "done" - without duplicate detection
     * this looped on the same handful of documents until it ran out of
     * budget. Now it stops the moment a page returns nothing new, same
     * defensive pattern as fetchDocumentHistory below, plus a hard page
     * safety cap as a second backstop.
     */
    /**
     * `maxDocuments` bounds this to the N most-recently-modified documents,
     * fetched directly via `sortColumn=modifiedAt&sortOrder=desc` rather
     * than paging through everything and sorting client-side - confirmed
     * live that this endpoint supports server-side sort, so getting the
     * top 20 costs exactly one call regardless of how many hundreds of
     * documents the account actually has. Discovered the account here has
     * 600+ documents; without this, "list my documents" would mean
     * backfilling all of them, at 1-3 Onshape calls each - nowhere near a
     * 150-call budget.
     */
    async listMyDocuments(maxDocuments = 20) {
      const filter = process.env.ONSHAPE_DOCUMENT_FILTER ?? "0";
      const PAGE_SIZE = 20;
      const seen = new Set();
      const docs = [];
      let pages = 0;

      for (let offset = 0; docs.length < maxDocuments; offset += PAGE_SIZE) {
        const payload = await get("/v6/documents", {
          filter,
          offset,
          limit: Math.min(PAGE_SIZE, maxDocuments - docs.length),
          sortColumn: "modifiedAt",
          sortOrder: "desc",
        });
        pages++;
        const items = Array.isArray(payload) ? payload : payload.items ?? [];
        if (items.length === 0) break;

        let newOnPage = 0;
        for (const doc of items) {
          if (seen.has(doc.id)) continue;
          seen.add(doc.id);
          docs.push(doc);
          newOnPage++;
        }
        if (newOnPage === 0) break; // endpoint ignoring offset - stop rather than loop forever
        if (items.length < PAGE_SIZE) break;
      }
      return { docs, pages };
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
     * Fetches documenthistory for one document/workspace - a single call,
     * not a paginated loop. Confirmed live (burning real quota to find
     * out): this endpoint hard-caps at the 50 most recent microversions
     * and silently ignores `offset` and every cursor-shaped parameter
     * tried (`microversionId`, `startingAfter`, `beforeMicroversionId`,
     * `startMicroversionId`) - it just returns the same 50 rows regardless.
     * There's no Link header or cursor field in the response either.
     * Retrying with a bumped offset doesn't get more data, it just spends
     * a call to fetch the identical 50 rows again - so this is one call,
     * always, by design, not a corner we cut.
     *
     * A result of exactly 50 rows is a signal, not a coincidence: it means
     * this document likely has more history than we can currently reach,
     * same shape as the original Phase 0 "suspiciously round number" bug,
     * just on this endpoint instead. `possiblyTruncatedAt50` surfaces that
     * so the caller can report it rather than silently treating 50 as "the
     * whole history."
     *
     * `cutoffDate` still trims rows older than the accepted window from
     * the (at most 50) rows actually returned - still meaningful for a
     * quiet document whose real history spans more than 12 months but
     * fits well under 50 microversions.
     */
    async fetchDocumentHistory(documentId, workspaceId, { cutoffDate } = {}) {
      const PAGE_SIZE = 100; // requested; the server silently caps the actual response at 50
      const path = `/v6/documents/d/${documentId}/w/${workspaceId}/documenthistory`;
      const payload = await get(path, { limit: PAGE_SIZE });
      const items = extractRows(payload);
      const possiblyTruncatedAt50 = items.length === 50;

      const rows = cutoffDate
        ? items.filter((r) => new Date(r.date).getTime() >= cutoffDate.getTime())
        : items;

      return { rows, pages: 1, possiblyTruncatedAt50 };
    },

    /**
     * Registers one webhook covering every event type in `events` for a
     * single document - Onshape's createWebhook takes `events` as an array,
     * so one registration is enough per document rather than one per event
     * type. `isTransient: false` is load-bearing: without it, Onshape
     * quietly cleans the registration up after a period of inactivity (see
     * https://onshape-public.github.io/docs/app-dev/webhook/#events), which
     * on a personal document that might go quiet for weeks would otherwise
     * silently stop tracking with no error anywhere.
     */
    async registerWebhook({ documentId, events, url, collapseEvents = true }) {
      return post("/v6/webhooks", {
        documentId,
        events,
        url,
        isTransient: false,
        options: { collapseEvents },
      });
    },

    /** Lists every webhook registered under this account (any document). */
    async listWebhooks(userId) {
      const PAGE_SIZE = 20;
      const webhooks = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const payload = await get("/v6/webhooks", { user: userId, offset, limit: PAGE_SIZE });
        const items = extractRows(payload);
        webhooks.push(...items);
        if (items.length < PAGE_SIZE) break;
      }
      return webhooks;
    },

    async unregisterWebhook(webhookId) {
      return del(`/v6/webhooks/${webhookId}`, { blockNotification: false });
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
