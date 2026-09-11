"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  AVATAR_COLORS,
  DEFAULT_LOCAL_PROFILE,
  initialsFromDisplayName,
  readLocalProfile,
  writeLocalProfile,
  type LocalProfile,
} from "@/lib/localProfile";

export function ProfileIdentity({ memberSince, handle }: { memberSince: string; handle: string }) {
  const [profile, setProfile] = useState<LocalProfile>(DEFAULT_LOCAL_PROFILE);
  const [draft, setDraft] = useState<LocalProfile>(DEFAULT_LOCAL_PROFILE);
  const [editing, setEditing] = useState(false);
  const [initialsLocked, setInitialsLocked] = useState(false);

  useEffect(() => {
    const stored = readLocalProfile();
    setProfile(stored);
    setDraft(stored);
  }, []);

  function openEditor() {
    setDraft(profile);
    setInitialsLocked(profile.initials !== initialsFromDisplayName(profile.displayName));
    setEditing(true);
  }

  function onNameChange(displayName: string) {
    setDraft((prev) => ({
      ...prev,
      displayName,
      initials: initialsLocked ? prev.initials : initialsFromDisplayName(displayName),
    }));
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const next: LocalProfile = {
      displayName: draft.displayName.trim() || DEFAULT_LOCAL_PROFILE.displayName,
      initials: (draft.initials.trim() || initialsFromDisplayName(draft.displayName)).slice(0, 3).toUpperCase(),
      avatarColor: draft.avatarColor,
    };
    writeLocalProfile(next);
    setProfile(next);
    setEditing(false);
  }

  return (
    <div>
      <button type="button" className="profile-identity" onClick={openEditor} aria-expanded={editing}>
        <span
          className="avatar"
          style={{
            width: 54,
            height: 54,
            fontSize: 19,
            background: profile.avatarColor,
            color: "#fff",
            boxShadow: "0 6px 0 0 var(--chunk-edge-neutral-strong)",
          }}
          aria-hidden="true"
        >
          {profile.initials}
        </span>
        <span className="stack" style={{ gap: 2, textAlign: "left" }}>
          <span className="t-title3">{profile.displayName}</span>
          <span className="t-footnote dim">
            {handle} &middot; since {memberSince}
          </span>
          <span className="t-caption dimmer">Tap to edit</span>
        </span>
      </button>

      {editing ? (
        <form className="profile-edit chunk" onSubmit={save}>
          <label className="field">
            <span className="field__label">Display name</span>
            <input
              className="field__input"
              value={draft.displayName}
              onChange={(e) => onNameChange(e.target.value)}
              autoComplete="nickname"
              maxLength={40}
            />
          </label>
          <label className="field">
            <span className="field__label">Initials</span>
            <input
              className="field__input"
              value={draft.initials}
              onChange={(e) => {
                setInitialsLocked(true);
                setDraft((prev) => ({ ...prev, initials: e.target.value.slice(0, 3).toUpperCase() }));
              }}
              maxLength={3}
              autoCapitalize="characters"
              aria-describedby="initials-hint"
            />
            <span id="initials-hint" className="t-caption dimmer">
              Up to 3 letters. Updates from the name unless you type here.
            </span>
          </label>
          <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="field__label">Colour</legend>
            <div className="swatch-row" role="radiogroup" aria-label="Avatar colour">
              {AVATAR_COLORS.map((c) => {
                const selected = draft.avatarColor === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={c.label}
                    className="swatch"
                    style={{ background: c.hex }}
                    onClick={() => setDraft((prev) => ({ ...prev, avatarColor: c.hex }))}
                  />
                );
              })}
            </div>
          </fieldset>
          <div className="profile-edit__actions">
            <button type="button" className="text-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="text-btn text-btn--strong">
              Save
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
