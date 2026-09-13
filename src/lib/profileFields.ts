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

export const HANDLE_MIN = 2;
export const HANDLE_MAX = 20;
const HANDLE_RE = /^[a-z][a-z0-9_]{1,19}$/;
const RESERVED_HANDLES = new Set([
  "admin",
  "api",
  "connect",
  "help",
  "join",
  "league",
  "login",
  "onshape",
  "profile",
  "sessions",
  "signup",
  "support",
  "today",
  "welcome",
  "xtrude",
]);

export function handleUserKey(userId: string): string {
  return `handle_user_${userId}`;
}

export function handleTakenKey(handle: string): string {
  return `handle_taken_${handle}`;
}

export function sanitizeHandle(raw: string): string | null {
  const handle = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!HANDLE_RE.test(handle)) return null;
  if (RESERVED_HANDLES.has(handle)) return null;
  return handle;
}

export function displayHandle(handle: string | null | undefined): string {
  if (!handle) return "";
  const inner = handle.replace(/^@+/, "");
  return inner ? `@${inner}` : "";
}

export function planHandleClaim(opts: {
  userId: string;
  raw: string;
  takenBy: string | null;
}): { ok: true; handle: string } | { ok: false; reason: string } {
  const handle = sanitizeHandle(opts.raw);
  if (!handle) {
    return {
      ok: false,
      reason: `Use ${HANDLE_MIN}–${HANDLE_MAX} characters: start with a letter, then letters, numbers, or _.`,
    };
  }
  if (opts.takenBy && opts.takenBy !== opts.userId) {
    return { ok: false, reason: "That @ is taken." };
  }
  return { ok: true, handle };
}
