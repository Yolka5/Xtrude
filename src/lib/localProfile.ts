/**
 * Device-local user profile. Shape matches the `users` row
 * (display_name, initials, avatar_color). Not sent to the server today;
 * the server still uses the Yoni row from supabase/migrate-users.sql.
 */

export const LOCAL_PROFILE_STORAGE_KEY = "xtrude.localProfile.v1";

export type LocalProfile = {
  displayName: string;
  initials: string;
  avatarColor: string;
};

/** Colours already in globals.css; white initials clear 3:1 on each (bold 19px). */
export const AVATAR_COLORS = [
  { id: "charcoal", label: "Charcoal", hex: "#2b2b30" },
  { id: "violet", label: "Violet", hex: "#9e74e7" },
  { id: "magenta", label: "Magenta", hex: "#8518aa" },
  { id: "orange", label: "Orange", hex: "#ff5500" },
  { id: "red", label: "Red", hex: "#c2290a" },
] as const;

export const DEFAULT_LOCAL_PROFILE: LocalProfile = {
  displayName: "You",
  initials: "YS",
  avatarColor: AVATAR_COLORS[0].hex,
};

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  const one = parts[0] ?? "";
  return (one.slice(0, 2) || DEFAULT_LOCAL_PROFILE.initials).toUpperCase();
}

function isProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== "object") return false;
  const v = value as LocalProfile;
  return (
    typeof v.displayName === "string" &&
    typeof v.initials === "string" &&
    typeof v.avatarColor === "string"
  );
}

export function readLocalProfile(): LocalProfile {
  if (typeof window === "undefined") return DEFAULT_LOCAL_PROFILE;
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_PROFILE;
    const parsed = JSON.parse(raw) as unknown;
    if (!isProfile(parsed)) return DEFAULT_LOCAL_PROFILE;
    const displayName = parsed.displayName.trim() || DEFAULT_LOCAL_PROFILE.displayName;
    const initials = parsed.initials.trim().slice(0, 3).toUpperCase() || initialsFromDisplayName(displayName);
    const known = AVATAR_COLORS.some((c) => c.hex === parsed.avatarColor);
    return {
      displayName,
      initials,
      avatarColor: known ? parsed.avatarColor : DEFAULT_LOCAL_PROFILE.avatarColor,
    };
  } catch {
    return DEFAULT_LOCAL_PROFILE;
  }
}

export function writeLocalProfile(profile: LocalProfile): void {
  window.localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
