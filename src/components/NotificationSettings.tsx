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
      <div className="section-head" style={{ margin: "0 0 4px" }}>
        <h2>Notifications</h2>
      </div>

      <label className="setting-row">
        <span className="stack" style={{ gap: 2 }}>
          <span className="t-subhead">Streak at risk</span>
          <span className="t-caption dimmer">An evening nudge before the day runs out</span>
        </span>
        <span className="switch">
          <input
            type="checkbox"
            checked={streak}
            onChange={(e) => void save({ streak: e.target.checked })}
          />
          <span className="switch__track" aria-hidden="true" />
          <span className="switch__knob" aria-hidden="true" />
        </span>
      </label>

      <label className="setting-row">
        <span className="stack" style={{ gap: 2 }}>
          <span className="t-subhead">Passed in a league</span>
          <span className="t-caption dimmer">When someone moves ahead of you</span>
        </span>
        <span className="switch">
          <input
            type="checkbox"
            checked={league}
            onChange={(e) => void save({ league: e.target.checked })}
          />
          <span className="switch__track" aria-hidden="true" />
          <span className="switch__knob" aria-hidden="true" />
        </span>
      </label>

      <div className="stack" style={{ gap: 10, marginTop: 16 }}>
        <button
          type="button"
          className="btn btn-prism btn-block"
          onClick={async () => {
            const err = await enablePush();
            setStatus(err ?? "Reminders on.");
          }}
        >
          Enable push on this device
        </button>
        <button
          type="button"
          className="text-btn text-btn--sm"
          style={{ alignSelf: "center" }}
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
      </div>

      {available === false ? (
        <p className="t-caption dimmer reply-in" style={{ margin: "10px 0 0", textAlign: "center" }}>
          Push is unavailable on this server. Today still works.
        </p>
      ) : status ? (
        <p key={status} className="t-caption dimmer reply-in" style={{ margin: "10px 0 0", textAlign: "center" }}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
