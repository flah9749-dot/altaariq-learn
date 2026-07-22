// Server-only helper to broadcast in-app notifications to students by target,
// and to send FCM push notifications so users receive them even when the app
// is closed/backgrounded.

type Target =
  | { kind: "all" }
  | { kind: "class"; class_id: string | null }
  | { kind: "group"; group_id: string | null }
  | { kind: "classes_groups"; class_id?: string | null; group_ids?: string[] };

export async function pushToUsers(userIds: string[], opts: {
  title: string;
  body: string;
  link?: string | null;
}) {
  try {
    const ids = Array.from(new Set((userIds ?? []).filter(Boolean)));
    if (!ids.length) return { sent: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokens } = await supabaseAdmin
      .from("push_tokens").select("token,user_id").in("user_id", ids);
    const list = (tokens ?? []).map((r: any) => r.token as string).filter(Boolean);
    if (!list.length) return { sent: 0 };
    const { sendFcm } = await import("./fcm.server");
    const results = await sendFcm(list.map((t) => ({
      token: t, title: opts.title, body: opts.body, link: opts.link ?? "/",
    })));
    const dead = results.filter((r) => r.invalidToken).map((r) => r.token);
    if (dead.length) {
      await supabaseAdmin.from("push_tokens").delete().in("token", dead);
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
  const recipients = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean)));
  if (!recipients.length) return { count: 0, pushed: 0 };

  await supabaseAdmin.from("notifications").insert(
    recipients.map((uid: string) => ({
      user_id: uid,
      title: opts.title,
      body: opts.body,
      type: opts.type ?? "general",
      link: opts.link ?? null,
    })),
  );
  const push = await pushToUsers(recipients, { title: opts.title, body: opts.body, link: opts.link ?? null });
  return { count: recipients.length, pushed: push.sent ?? 0 };
}
