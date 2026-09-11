"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { profileImageUrlFromSession } from "@/lib/profileFields";

export function ProfileIdentity({
  displayName,
  memberSince,
  handle,
  imageUrl,
}: {
  displayName: string;
  memberSince: string;
  handle: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [draft, setDraft] = useState(displayName);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picture = profileImageUrlFromSession({ image: imageUrl ?? undefined });

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  function openEditor() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: draft }),
      });
      const json = (await res.json()) as { displayName?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      setName(json.displayName || draft.trim());
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <button type="button" className="profile-identity" onClick={openEditor} aria-expanded={editing}>
        {picture ? (
          <span
            className="avatar"
            style={{
              width: 54,
              height: 54,
              overflow: "hidden",
              boxShadow: "0 6px 0 0 var(--chunk-edge-neutral-strong)",
            }}
            aria-hidden="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picture} alt="" width={54} height={54} style={{ width: 54, height: 54, objectFit: "cover" }} />
          </span>
        ) : null}
        <span className="stack" style={{ gap: 2, textAlign: "left" }}>
          <span className="t-title3">{name}</span>
          <span className="t-footnote dim">
            {handle} &middot; since {memberSince}
          </span>
          <span className="t-caption dimmer">Tap to edit name</span>
        </span>
      </button>

      {editing ? (
        <form className="profile-edit chunk" onSubmit={save}>
          <label className="field">
            <span className="field__label">Display name</span>
            <input
              className="field__input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoComplete="nickname"
              maxLength={80}
            />
          </label>
          {error ? <p className="t-caption" style={{ color: "var(--neg, #b42318)", margin: 0 }}>{error}</p> : null}
          <div className="profile-edit__actions">
            <button type="button" className="text-btn" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="text-btn text-btn--strong" disabled={saving}>
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
