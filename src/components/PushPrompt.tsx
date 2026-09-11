"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "xtrude.pushPromptDismissed";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(): Promise<string | null> {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "Push is not available in this browser.";
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Permission was not granted.";
  const vapid = await fetch("/api/push/vapid/");
  if (!vapid.ok) return "Push is not configured on the server yet.";
  const { publicKey } = (await vapid.json()) as { publicKey: string };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!res.ok) return "Could not save the subscription.";
  return null;
}

/** Quiet banner after the person already has a streak — never on first load. */
export function PushPrompt({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (!("serviceWorker" in navigator)) return;
    const t = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (!visible) return null;

  return (
    <section className="chunk chunk-sm" style={{ marginTop: 14 }}>
      <p className="t-footnote" style={{ margin: "0 0 8px" }}>
        Get a nudge in the evening if today is empty and a streak is at risk.
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button
          type="button"
          className="text-btn text-btn--strong"
          onClick={async () => {
            await enablePush();
            window.localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Enable
        </button>
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}
