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

export type HandleIdentity = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

/** First usable @ stem from an Onshape profile. Never defaults to yoni. */
export function handleStemFromIdentity(info: HandleIdentity): string | null {
  const first = info.firstName?.trim() ?? "";
  const last = info.lastName?.trim() ?? "";
  const candidates = [first, `${first}${last}`, info.name, info.email?.split("@")[0]];
  for (const raw of candidates) {
    if (!raw) continue;
    const stripped = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!stripped) continue;
    const withLetter = /^[a-z]/.test(stripped) ? stripped : `u${stripped}`;
    const handle = sanitizeHandle(withLetter.slice(0, HANDLE_MAX));
    if (handle) return handle;
  }
  return null;
}

export function handleCandidateAt(stem: string, attempt: number): string | null {
  if (attempt === 0) return sanitizeHandle(stem);
  const suffix = String(attempt + 1);
  const room = HANDLE_MAX - suffix.length;
  if (room < HANDLE_MIN) return null;
  return sanitizeHandle(`${stem.slice(0, room)}${suffix}`);
}
