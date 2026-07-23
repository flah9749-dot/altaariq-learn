// Trim long chat histories: keep the most recent N messages verbatim,
// summarize older ones into a single system note. Callers pass an already-
// normalized message list; we return a shorter list ready to send.

export type SimpleMsg = { role: "system" | "user" | "assistant"; content: string };

const KEEP_RECENT = 8;
const SUMMARIZE_AFTER = 12;

export function trimHistory(messages: SimpleMsg[]): {
  trimmed: SimpleMsg[];
  needsSummary: SimpleMsg[] | null;
} {
  const systems = messages.filter((m) => m.role === "system");
  const convo = messages.filter((m) => m.role !== "system");
  if (convo.length <= SUMMARIZE_AFTER) {
    return { trimmed: messages, needsSummary: null };
  }
  const older = convo.slice(0, convo.length - KEEP_RECENT);
  const recent = convo.slice(convo.length - KEEP_RECENT);
  return {
    trimmed: [...systems, ...recent],
    needsSummary: older,
  };
}

/** Cheap client-side clamp: strip repeated whitespace and cap length. */
export function compactContent(content: string, maxChars = 4000): string {
  const cleaned = content.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars) + "\n[...]";
}
