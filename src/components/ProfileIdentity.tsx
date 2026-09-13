"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { profileImageUrlFromSession } from "@/lib/profileFields";
import { Icon } from "./Icon";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase() || "?";
}

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
  const [at, setAt] = useState(handle);
  const [draft, setDraft] = useState(displayName);
  const [draftHandle, setDraftHandle] = useState(handle.replace(/^@/, ""));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picture = profileImageUrlFromSession({ image: imageUrl ?? undefined });

  useEffect(() => {
    setName(displayName);
  }, [displayName]);

  useEffect(() => {
    setAt(handle);
    setDraftHandle(handle.replace(/^@/, ""));
  }, [handle]);

  function openEditor() {
    setDraft(name);
    setDraftHandle(at.replace(/^@/, ""));
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
        body: JSON.stringify({ displayName: draft, handle: draftHandle }),
      });
      const json = (await res.json()) as { displayName?: string; handle?: string; error?: string };
      if (!res.ok) throw new Error(json.error || "Could not save");
      setName(json.displayName || draft.trim());
      if (json.handle) setAt(json.handle);
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
        <span className="profile-identity__disc" aria-hidden="true">
          {picture ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={picture} alt="" width={54} height={54} style={{ width: 54, height: 54, objectFit: "cover" }} />
          ) : (
            initials(name)
          )}
        </span>
        <span className="stack" style={{ gap: 2, textAlign: "left", flex: 1, minWidth: 0 }}>
          <span className="t-title3">{name}</span>
          <span className="t-footnote dim">
            {at || "Choose your @"} &middot; since {memberSince}
          </span>
        </span>
        <span className="profile-identity__edit" aria-hidden="true">
          <Icon name="pencil" size={16} />
        </span>
        <span className="sr-only">Edit name and handle</span>
      </button>

      {editing ? (
        <form className="profile-edit chunk expand-in" onSubmit={save}>
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
          <label className="field">
            <span className="field__label">Handle</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="t-headline" aria-hidden="true">@</span>
              <input
                className="field__input"
                value={draftHandle}
                onChange={(e) => setDraftHandle(e.target.value.replace(/^@/, ""))}
                autoComplete="username"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={20}
              />
            </span>
          </label>
          {error ? <p className="t-caption" style={{ color: "var(--neg, #b42318)", margin: 0 }}>{error}</p> : null}
          <div className="profile-edit__actions">
            <button type="button" className="text-btn" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-prism btn-sm" disabled={saving}>
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
