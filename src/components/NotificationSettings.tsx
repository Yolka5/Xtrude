"use client";

import { useEffect, useState } from "react";
import { enablePush } from "./PushPrompt";

export function NotificationSettings() {
  const [streak, setStreak] = useState(true);
  const [league, setLeague] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    void fetch("/api/push/prefs/")
      .then((r) => r.json())
      .then((j: { streak?: boolean; league?: boolean }) => {
        if (typeof j.streak === "boolean") setStreak(j.streak);
        if (typeof j.league === "boolean") setLeague(j.league);
      })
      .catch(() => {});
    void fetch("/api/push/vapid/")
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, []);

  async function save(next: { streak?: boolean; league?: boolean }) {
    setStreak(next.streak ?? streak);
    setLeague(next.league ?? league);
    await fetch("/api/push/prefs/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
  }

  return (
    <section className="chunk" style={{ marginTop: 8 }}>
      <p className="t-footnote dim" style={{ margin: "0 0 10px" }}>Notifications</p>
      <label className="row" style={{ gap: 10, marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={streak}
          onChange={(e) => void save({ streak: e.target.checked })}
        />
        <span className="t-footnote">Streak at risk, evening</span>
      </label>
      <label className="row" style={{ gap: 10, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={league}
          onChange={(e) => void save({ league: e.target.checked })}
        />
        <span className="t-footnote">Someone passes you in a league</span>
      </label>
      <button
        type="button"
        className="text-btn text-btn--strong"
        style={{ paddingLeft: 0 }}
        onClick={async () => {
          const err = await enablePush();
          setStatus(err ?? "Reminders on.");
        }}
      >
        Enable push on this device
      </button>
      <button
        type="button"
        className="text-btn"
        style={{ paddingLeft: 0 }}
        onClick={async () => {
          try {
            const res = await fetch("/api/push/test/", { method: "POST" });
            const json = (await res.json()) as { sent?: number; unavailable?: boolean };
            if (json.unavailable) setStatus("Push is unavailable on the server.");
            else if ((json.sent ?? 0) > 0) setStatus("Test sent — check the notification.");
            else setStatus("No subscription on this device yet. Enable push first.");
          } catch {
            setStatus("Push is unavailable right now.");
          }
        }}
      >
        Send a test notification
      </button>
      {available === false ? (
        <p className="t-caption dimmer" style={{ margin: "8px 0 0" }}>
          Push is unavailable on this server. Today still works.
        </p>
      ) : status ? (
        <p className="t-caption dimmer" style={{ margin: "8px 0 0" }}>{status}</p>
      ) : null}
    </section>
  );
}
