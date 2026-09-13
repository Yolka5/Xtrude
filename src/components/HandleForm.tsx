"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HANDLE_MAX } from "@/lib/profileFields";

export function HandleForm({
  initialHandle = "",
  nextPath = "/",
  submitLabel = "Save @",
}: {
  initialHandle?: string;
  nextPath?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialHandle.replace(/^@/, ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: draft }),
      });
      const json = (await res.json()) as { handle?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-edit chunk" onSubmit={save}>
      <label className="field">
        <span className="field__label">Your @</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="t-headline" aria-hidden="true">@</span>
          <input
            className="field__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/^@/, ""))}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={HANDLE_MAX}
            placeholder="yourname"
          />
        </span>
        <span className="t-caption dimmer">2–20 characters. Letters, numbers, and _. This is how you show up.</span>
      </label>
      {error ? <p className="t-caption" style={{ color: "var(--neg, #b42318)", margin: 0 }}>{error}</p> : null}
      <div className="profile-edit__actions">
        <button type="submit" className="text-btn text-btn--strong" disabled={saving || draft.trim().length < 2}>
          {saving ? "Saving" : submitLabel}
        </button>
      </div>
    </form>
  );
}
