// Server-only helper to broadcast in-app notifications to students by target,
// and to send FCM push notifications so users receive them even when the app
// is closed/backgrounded.
//
// SCALE NOTES:
//  - PostgREST `.in(col, [...])` puts every value in the URL; a list of 5000
//    UUIDs blows past the 4-8KB URL limit. All large `IN` queries here chunk.
//  - `sendFcm` fires one HTTP call per token in parallel; unbounded parallel
//    fetch on the Worker exhausts sockets and starves other requests. We cap
//    concurrency per batch.
//  - `notifications` bulk insert is also chunked so a class of thousands
//    doesn't produce a single multi-megabyte request row.

type Target =
  | { kind: "all" }
  | { kind: "class"; class_id: string | null }
  | { kind: "group"; group_id: string | null }
  | { kind: "classes_groups"; class_id?: string | null; group_ids?: string[] };

const PUSH_TOKEN_LOOKUP_CHUNK = 200;   // keeps ?in=(...) URL well under limits
const NOTIF_INSERT_CHUNK = 500;
const FCM_PARALLEL = 25;               // simultaneous HTTP calls to Google

async function chunk<T, R>(arr: T[], size: number, fn: (part: T[]) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < arr.length; i += size) out.push(await fn(arr.slice(i, i + size)));
  return out;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function pushToUsers(userIds: string[], opts: {
  title: string;
  body: string;
  link?: string | null;
}) {
  try {
    const ids = Array.from(new Set((userIds ?? []).filter(Boolean)));
    if (!ids.length) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Chunk the token lookup so the query URL stays bounded.
    const tokenRows: Array<{ token: string; user_id: string }> = [];
    await chunk(ids, PUSH_TOKEN_LOOKUP_CHUNK, async (part) => {
      const { data } = await supabaseAdmin
        .from("push_tokens").select("token,user_id").in("user_id", part);
      for (const r of data ?? []) tokenRows.push(r as any);
      return null;
    });
    const list = tokenRows.map((r) => r.token).filter(Boolean);
    if (!list.length) return { sent: 0 };

    const { sendFcm } = await import("./fcm.server");
    // Chunk FCM sends so we don't open 5000 sockets at once on the Worker.
    // sendFcm itself parallelizes within the batch; we cap the batch size.
    const results: Array<{ token: string; ok: boolean; invalidToken?: boolean }> = [];
    for (let i = 0; i < list.length; i += FCM_PARALLEL) {
      const part = list.slice(i, i + FCM_PARALLEL).map((t) => ({
        token: t, title: opts.title, body: opts.body, link: opts.link ?? "/",
      }));
      const r = await sendFcm(part);
      results.push(...r);
    }
    const dead = results.filter((r) => r.invalidToken).map((r) => r.token);
    if (dead.length) {
      await chunk(dead, PUSH_TOKEN_LOOKUP_CHUNK, async (part) => {
        await supabaseAdmin.from("push_tokens").delete().in("token", part);
        return null;
      });
    }
    return { sent: results.filter((r) => r.ok).length };
  } catch (e) {
    console.error("[pushToUsers] failed:", e);
    return { sent: 0, error: String(e) };
  }
}

export async function notifyStudents(opts: {
  title: string;
  body: string;
  type?: string;
  link?: string | null;
  target: Target;
  /** When set, notifications carry this dedupe key per recipient so repeat
   * calls (double clicks, retries, republish) do not create duplicate rows. */
  dedupe_key?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("students")
    .select("user_id")
    .not("user_id", "is", null)
    .eq("status", "active");

  const t = opts.target;
  if (t.kind === "class" && t.class_id) q = q.eq("class_id", t.class_id);
  else if (t.kind === "group" && t.group_id) q = q.eq("group_id", t.group_id);
  else if (t.kind === "classes_groups") {
    if (t.class_id) q = q.eq("class_id", t.class_id);
    if (t.group_ids && t.group_ids.length) q = q.in("group_id", t.group_ids);
  }

  const { data: rows } = await q;
  let recipients = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))) as string[];
  if (!recipients.length) return { count: 0, pushed: 0 };

  // Skip recipients that already received the same dedupe_key to make repeat
  // calls (double clicks, retries, republish) idempotent.
  if (opts.dedupe_key) {
    const existing = new Set<string>();
    await chunk(recipients, PUSH_TOKEN_LOOKUP_CHUNK, async (part) => {
      const { data } = await supabaseAdmin
        .from("notifications")
        .select("user_id")
        .eq("dedupe_key", opts.dedupe_key!)
        .in("user_id", part);
      for (const r of data ?? []) existing.add((r as any).user_id);
      return null;
    });
    recipients = recipients.filter((u) => !existing.has(u));
    if (!recipients.length) return { count: 0, pushed: 0 };
  }

  // Chunk bulk inserts so a class of thousands doesn't produce one huge
  // multi-megabyte payload that stalls PostgREST.
  await chunk(recipients, NOTIF_INSERT_CHUNK, async (part) => {
    const payload = part.map((uid: string) => ({
      user_id: uid,
      title: opts.title,
      body: opts.body,
      type: opts.type ?? "general",
      link: opts.link ?? null,
      dedupe_key: opts.dedupe_key ?? null,
    }));
    const { error } = opts.dedupe_key
      ? await supabaseAdmin.from("notifications").upsert(payload, {
          onConflict: "user_id,dedupe_key",
          ignoreDuplicates: true,
        })
      : await supabaseAdmin.from("notifications").insert(payload);
    if (error) console.error("[notifyStudents] notification insert chunk failed:", error);
    return null;
  });
  const push = await pushToUsers(recipients, { title: opts.title, body: opts.body, link: opts.link ?? null });
  return { count: recipients.length, pushed: push.sent ?? 0 };
}

// Exported chunker for other server modules that need to fan out large lists.
export { mapWithConcurrency };
