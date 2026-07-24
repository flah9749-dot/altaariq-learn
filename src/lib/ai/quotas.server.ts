// AI Quota system — resolves per-user limits, reserves before AI calls,
// commits on success, rolls back on cache-hit or failure.

export type QuotaFeature =
  | "assistant_message"
  | "file_upload"
  | "exam_generation"
  | "essay_grading"
  | "summary"
  | "lesson_explain"
  | "map_analysis"
  | "content_plan";

export type QuotaPeriod = "daily" | "weekly" | "monthly";

export type ResolvedQuota = {
  feature: QuotaFeature;
  period: QuotaPeriod;
  limit: number;
  unlimited: boolean;
  max_file_mb: number | null;
  max_pages: number | null;
  enabled: boolean;
};

export class QuotaExceededError extends Error {
  status = 429;
  constructor(
    public feature: QuotaFeature,
    public used: number,
    public limit: number,
    public period: QuotaPeriod,
    public resetAt: string,
  ) {
    super(
      `استهلكت حصتك من هذه الميزة (${used}/${limit}). تتجدد ${humanReset(period, resetAt)}. للمزيد راسل المعلم.`,
    );
  }
}

/** period_key uses Africa/Cairo (UTC+2, no DST) — safely computed as UTC+2h. */
export function periodKey(period: QuotaPeriod, now = new Date()): string {
  const cairo = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const y = cairo.getUTCFullYear();
  const m = String(cairo.getUTCMonth() + 1).padStart(2, "0");
  const d = String(cairo.getUTCDate()).padStart(2, "0");
  if (period === "daily") return `${y}-${m}-${d}`;
  if (period === "monthly") return `${y}-${m}`;
  // ISO week
  const target = new Date(Date.UTC(y, cairo.getUTCMonth(), cairo.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function nextResetIso(period: QuotaPeriod, now = new Date()): string {
  const cairo = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  let next: Date;
  if (period === "daily") {
    next = new Date(Date.UTC(cairo.getUTCFullYear(), cairo.getUTCMonth(), cairo.getUTCDate() + 1));
  } else if (period === "monthly") {
    next = new Date(Date.UTC(cairo.getUTCFullYear(), cairo.getUTCMonth() + 1, 1));
  } else {
    const dayNum = (cairo.getUTCDay() + 6) % 7;
    next = new Date(Date.UTC(cairo.getUTCFullYear(), cairo.getUTCMonth(), cairo.getUTCDate() + (7 - dayNum)));
  }
  // convert back to UTC by subtracting Cairo offset
  return new Date(next.getTime() - 2 * 60 * 60 * 1000).toISOString();
}

function humanReset(period: QuotaPeriod, iso: string): string {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  });
  const label = period === "daily" ? "يومياً" : period === "weekly" ? "أسبوعياً" : "شهرياً";
  return `${label} (${fmt.format(d)})`;
}

export async function resolveQuota(
  userId: string,
  role: "admin" | "student",
  feature: QuotaFeature,
): Promise<ResolvedQuota> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: policy }, { data: override }] = await Promise.all([
    supabaseAdmin
      .from("ai_quota_policies")
      .select("*")
      .eq("role", role)
      .eq("feature", feature)
      .maybeSingle(),
    supabaseAdmin
      .from("ai_quota_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("feature", feature)
      .maybeSingle(),
  ]);

  // If no policy AND no override → unrestricted (feature not tracked yet).
  if (!policy && !override) {
    return {
      feature,
      period: "daily",
      limit: Number.MAX_SAFE_INTEGER,
      unlimited: true,
      max_file_mb: null,
      max_pages: null,
      enabled: true,
    };
  }

  const p: any = policy ?? {};
  const o: any = override ?? {};
  return {
    feature,
    period: (o.period ?? p.period ?? "daily") as QuotaPeriod,
    limit: o.unlimited ? Number.MAX_SAFE_INTEGER : (o.limit_count ?? p.limit_count ?? 20),
    unlimited: !!o.unlimited,
    max_file_mb: o.max_file_mb ?? p.max_file_mb ?? null,
    max_pages: o.max_pages ?? p.max_pages ?? null,
    enabled: p.enabled !== false,
  };
}

/** Throws QuotaExceededError if over the limit. Does NOT increment. */
export async function checkQuota(
  userId: string,
  role: "admin" | "student",
  feature: QuotaFeature,
): Promise<{ quota: ResolvedQuota; used: number }> {
  const quota = await resolveQuota(userId, role, feature);
  if (quota.unlimited || !quota.enabled) return { quota, used: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const key = periodKey(quota.period);
  const { data } = await supabaseAdmin
    .from("ai_quota_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("feature", feature)
    .eq("period_key", key)
    .maybeSingle();
  const used = data?.count ?? 0;

  if (used >= quota.limit) {
    throw new QuotaExceededError(feature, used, quota.limit, quota.period, nextResetIso(quota.period));
  }
  return { quota, used };
}

/** Atomic-ish increment after a successful, non-cached AI call. */
export async function commitQuotaUsage(
  userId: string,
  feature: QuotaFeature,
  period: QuotaPeriod,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = periodKey(period);
    const nowIso = new Date().toISOString();
    // Upsert then increment. Two-step to keep it portable without a SQL function.
    const { data: existing } = await supabaseAdmin
      .from("ai_quota_usage")
      .select("id, count")
      .eq("user_id", userId)
      .eq("feature", feature)
      .eq("period_key", key)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin
        .from("ai_quota_usage")
        .update({ count: (existing.count ?? 0) + 1, last_used_at: nowIso })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin
        .from("ai_quota_usage")
        .insert({ user_id: userId, feature, period_key: key, count: 1, last_used_at: nowIso });
    }
  } catch {
    // Never block the user response on quota logging failure.
  }
}

/** Map an internal TaskType to a user-visible quota feature. */
export function taskToFeature(taskType: string): QuotaFeature | null {
  switch (taskType) {
    case "student_assistant_chat":
    case "admin_assistant_chat":
      return "assistant_message";
    case "student_assistant_file":
    case "admin_assistant_file":
      return "file_upload";
    case "exam_generate":
      return "exam_generation";
    case "essay_grading":
      return "essay_grading";
    case "map_analysis":
      return "map_analysis";
    case "summarize":
      return "summary";
    case "paraphrase":
      return "lesson_explain";
    default:
      return null; // internal / analytics tasks not counted
  }
}
