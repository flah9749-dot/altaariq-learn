// Local archive for AI assistant conversations (per user, per role)
// Persists to localStorage. Each role/user has its own list of sessions.

export type ArchivedMsg = {
  role: "user" | "assistant";
  content: string;
  // optional lightweight metadata (attachments not persisted to save space)
  files?: string[];
  attachmentNames?: string[];
};

export type ArchivedSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ArchivedMsg[];
};

const MAX_SESSIONS = 30;
const MAX_MSGS_PER_SESSION = 200;

function key(scope: "admin" | "student", userId: string | null | undefined) {
  return `assistant-archive:${scope}:${userId || "anon"}`;
}

function safeParse(raw: string | null): ArchivedSession[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function loadSessions(scope: "admin" | "student", userId: string | null | undefined): ArchivedSession[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(key(scope, userId)))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function writeSessions(scope: "admin" | "student", userId: string | null | undefined, list: ArchivedSession[]) {
  if (typeof window === "undefined") return;
  const trimmed = list
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  try {
    window.localStorage.setItem(key(scope, userId), JSON.stringify(trimmed));
  } catch {
    // storage full — drop half and retry once
    try {
      window.localStorage.setItem(
        key(scope, userId),
        JSON.stringify(trimmed.slice(0, Math.floor(trimmed.length / 2))),
      );
    } catch {
      /* ignore */
    }
  }
}

function deriveTitle(messages: ArchivedMsg[]): string {
  const first = messages.find((m) => m.role === "user" && m.content?.trim());
  const raw = (first?.content || "محادثة").trim().replace(/\s+/g, " ");
  return raw.length > 40 ? raw.slice(0, 40) + "…" : raw;
}

export function upsertSession(
  scope: "admin" | "student",
  userId: string | null | undefined,
  sessionId: string | null,
  messages: ArchivedMsg[],
): ArchivedSession | null {
  if (!messages.length) return null;
  const list = loadSessions(scope, userId);
  const now = Date.now();
  const trimmedMsgs = messages.slice(-MAX_MSGS_PER_SESSION);
  const existing = sessionId ? list.find((s) => s.id === sessionId) : null;
  const session: ArchivedSession = existing
    ? { ...existing, messages: trimmedMsgs, updatedAt: now, title: existing.title || deriveTitle(trimmedMsgs) }
    : {
        id: sessionId || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(now)),
        title: deriveTitle(trimmedMsgs),
        createdAt: now,
        updatedAt: now,
        messages: trimmedMsgs,
      };
  const next = [session, ...list.filter((s) => s.id !== session.id)];
  writeSessions(scope, userId, next);
  return session;
}

export function deleteSession(scope: "admin" | "student", userId: string | null | undefined, id: string) {
  writeSessions(scope, userId, loadSessions(scope, userId).filter((s) => s.id !== id));
}

export function renameSession(
  scope: "admin" | "student",
  userId: string | null | undefined,
  id: string,
  title: string,
) {
  const list = loadSessions(scope, userId).map((s) => (s.id === id ? { ...s, title: title.trim() || s.title } : s));
  writeSessions(scope, userId, list);
}

export function clearAll(scope: "admin" | "student", userId: string | null | undefined) {
  writeSessions(scope, userId, []);
}
