import { getSupabase } from "@/lib/db/client";
import { getCurrentUserId } from "@/lib/auth/currentUser";

export const dynamic = "force-dynamic";

/**
 * Plain observability page, not part of the consumer app's design system on
 * purpose - this is for answering "did webhooks break" at a glance, not for
 * daily use. No auth of its own: Phase 1 has none anywhere in this app
 * (single-user, service-role key only, see supabase/schema.sql's header
 * comment) - this page is exactly as exposed as Today/Sessions/Profile
 * already are, not a new hole.
 */

type Delivery = {
  id: string;
  received_at: string;
  onshape_webhook_id: string | null;
  event: string | null;
  accepted: boolean;
  reason: string;
  ip: string | null;
  tracked_documents: { name: string } | null;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminPage() {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();

  const { data: deliveries, error: deliveriesErr } = await supabase
    .from("webhook_deliveries")
    .select("id, received_at, onshape_webhook_id, event, accepted, reason, ip, tracked_documents(name)")
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(50);

  const { data: stateRows } = await supabase
    .from("app_state")
    .select("key, value, updated_at")
    .in("key", ["last_sync", "last_discovery", "last_rollup"]);
  const lastSync = stateRows?.find((r) => r.key === "last_sync");
  const lastDiscovery = stateRows?.find((r) => r.key === "last_discovery");
  const lastRollup = stateRows?.find((r) => r.key === "last_rollup");

  const rows = (deliveries ?? []) as unknown as Delivery[];
  const mostRecent = rows[0]?.received_at;

  const envNames = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ONSHAPE_ACCESS_KEY",
    "ONSHAPE_SECRET_KEY",
    "ONSHAPE_OAUTH_CLIENT_ID",
    "ONSHAPE_OAUTH_CLIENT_SECRET",
    "WEBHOOK_URL",
    "CRON_SECRET",
  ] as const;
  const envMissing = envNames.filter((name) => !process.env[name]);
  const webhookUrl = process.env.WEBHOOK_URL ?? "";
  const webhookUrlOk = webhookUrl === "https://xtrude-sooty.vercel.app/api/webhooks/onshape";

  return (
    <main style={{ padding: "24px 20px 60px", fontFamily: "ui-monospace, monospace", maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Xtrude admin</h1>
      <p style={{ color: "#666", marginTop: 0, marginBottom: 24, fontSize: 13 }}>
        Webhook delivery log. Not linked from the app - bookmark it.
      </p>

      <section style={{ marginBottom: 24, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <StatusCard
          label="Most recent delivery"
          value={mostRecent ? `${timeAgo(mostRecent)}` : "never"}
          detail={mostRecent ?? "no deliveries logged yet"}
        />
        <StatusCard
          label="Last sync"
          value={lastSync ? timeAgo(lastSync.updated_at) : "never ran"}
          detail={lastSync ? summarizeSync(lastSync.value) : "page load or GitHub Actions hourly"}
        />
        <StatusCard
          label="Last daily discovery"
          value={lastDiscovery ? timeAgo(lastDiscovery.updated_at) : "never ran"}
          detail={lastDiscovery ? summarizeDiscovery(lastDiscovery.value) : "Vercel Cron at 22:00 UTC (midnight IST / 01:00 IDT)"}
        />
        <StatusCard
          label="Last daily rollup"
          value={lastRollup ? timeAgo(lastRollup.updated_at) : "never ran"}
          detail={lastRollup ? summarizeRollup(lastRollup.value) : "same job as discovery, midnight Asia/Jerusalem"}
        />
        <StatusCard
          label="Vercel env"
          value={envMissing.length === 0 ? "all set" : `${envMissing.length} missing`}
          detail={
            envMissing.length === 0
              ? webhookUrlOk
                ? "WEBHOOK_URL matches the production endpoint"
                : `WEBHOOK_URL is set but is not the production /api/webhooks/onshape URL`
              : `missing: ${envMissing.join(", ")}`
          }
        />
      </section>

      {Array.isArray((lastDiscovery?.value as { users?: unknown[] } | undefined)?.users) ? (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Last discovery, per user</h2>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <Th>User</Th>
                <Th>Cadence</Th>
                <Th>Result</Th>
                <Th>Why</Th>
              </tr>
            </thead>
            <tbody>
              {((lastDiscovery?.value as { users: Array<{ userId: string; cadence: string; due: boolean; skipped: boolean; reason: string }> }).users).map((u) => (
                <tr key={u.userId} style={{ borderBottom: "1px solid #eee" }}>
                  <Td>{u.userId}</Td>
                  <Td>{u.cadence}</Td>
                  <Td>{u.due && !u.skipped ? "due" : "skipped"}</Td>
                  <Td>{u.reason}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Last {rows.length} deliveries</h2>
      {deliveriesErr ? (
        <p style={{ color: "#b00" }}>Failed to load: {deliveriesErr.message}</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#666" }}>No deliveries logged yet. Register a webhook, then edit a tracked document in Onshape.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                <Th>Received</Th>
                <Th>Document</Th>
                <Th>Event</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
                  <Td>{new Date(d.received_at).toISOString().replace("T", " ").slice(0, 19)}</Td>
                  <Td>{d.tracked_documents?.name ?? "-"}</Td>
                  <Td>{d.event ?? "-"}</Td>
                  <Td>
                    <span style={{ color: d.accepted ? "#0a7d2c" : "#b00", fontWeight: 700 }}>
                      {d.accepted ? "accepted" : "rejected"}
                    </span>
                  </Td>
                  <Td>{d.reason}</Td>
                  <Td>{d.ip ?? "-"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatusCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#888", wordBreak: "break-word" }}>{detail}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "6px 10px 6px 0", fontWeight: 700 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "6px 10px 6px 0", verticalAlign: "top" }}>{children}</td>;
}

function summarizeSync(v: any): string {
  if (!v) return "";
  const parts = [`${v.documentsSynced ?? 0}/${v.documentsChecked ?? 0} docs synced`, `${v.eventsWritten ?? 0} events written`];
  if (v.rebuild) parts.push(`${v.rebuild.sessionsWritten ?? 0} sessions`);
  if (v.errors?.length) parts.push(`${v.errors.length} error(s)`);
  return parts.join(" · ");
}

function summarizeDiscovery(v: any): string {
  if (!v) return "";
  const users = Array.isArray(v.users) ? v.users : [];
  const parts: string[] = [];
  if (users.length) {
    const ran = users.filter((u: { due?: boolean; skipped?: boolean }) => u.due && !u.skipped).length;
    const skipped = users.filter((u: { skipped?: boolean }) => u.skipped).length;
    parts.push(`${ran} discovered`, `${skipped} skipped`);
    for (const u of users) {
      const id = String(u.userId ?? "").slice(0, 8);
      const verb = u.due && !u.skipped ? "due" : "skipped";
      parts.push(`${id}: ${verb} — ${u.reason}`);
    }
  } else {
    parts.push(
      `${v.documentsSeen ?? 0} seen`,
      `${v.documentsAdded ?? 0} added`,
      `${v.documentsBackfilled ?? 0} first-backfilled`,
      `${v.webhooksRegistered ?? 0} registered`
    );
  }
  parts.push(`${v.callsUsed ?? 0} calls`);
  if (v.errors?.length) parts.push(`${v.errors.length} error(s)`);
  return parts.join(" · ");
}

function summarizeRollup(v: any): string {
  if (!v) return "";
  const parts: string[] = [];
  if (v.rollup) parts.push(`${v.rollup.sessionsWritten ?? 0} sessions`, `${v.rollup.activeDays ?? 0} active days`);
  if (v.streak) parts.push(`streak ${v.streak.current ?? 0} (best ${v.streak.longest ?? 0})`);
  return parts.join(" · ");
}
