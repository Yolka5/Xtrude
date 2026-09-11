/**
 * Profile helpers that do not invent an avatar when Onshape did not give a URL.
 */
export function profileImageUrlFromSession(info: { image?: unknown } | null | undefined): string | null {
  if (!info || typeof info.image !== "string") return null;
  const raw = info.image.trim();
  if (!raw) return null;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  return null;
}

export function sanitizeDisplayName(raw: string, fallback = "You"): string {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 80);
  return name.length >= 1 ? name : fallback;
}

export function memberSinceLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
