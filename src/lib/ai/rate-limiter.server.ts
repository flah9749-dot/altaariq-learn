// Sliding-window rate limiter for AI calls. Uses ai_rate_limits table
// with a 1-minute bucket. In-memory dedupe on top for the same exact
// request within 3 seconds (prevents double-click spam).

import { sha256Hex } from "./hash.server";

const INFLIGHT = new Map<string, number>();
const DEDUPE_MS = 3_000;

const DEFAULT_LIMITS = {
  admin: { perMin: 60, tokensPerMin: 120_000 },
  student: { perMin: 20, tokensPerMin: 40_000 },
};

export async function guardDuplicate(userId: string, requestHash: string) {
  const key = `${userId}:${requestHash}`;
  const now = Date.now();
  const last = INFLIGHT.get(key);
  if (last && now - last < DEDUPE_MS) {
    throw new Error("طلب مكرر — انتظر لحظة قبل المحاولة مرة أخرى");
  }
  INFLIGHT.set(key, now);
  // Best-effort cleanup
  if (INFLIGHT.size > 500) {
    for (const [k, t] of INFLIGHT) {
      if (now - t > DEDUPE_MS * 2) INFLIGHT.delete(k);
    }
  }
}

export async function enforceRateLimit(
  userId: string | null,
  role: "admin" | "student",
  weight: number,
): Promise<void> {
  if (!userId) return;
  const limits = DEFAULT_LIMITS[role];
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("ai_rate_limits")
      .select("id, request_count, token_count")
      .eq("user_id", userId)
      .eq("window_start", windowStart)
      .maybeSingle();

    const nextCount = (row?.request_count ?? 0) + weight;
    if (nextCount > limits.perMin) {
      throw new Error(`تجاوزت الحد المسموح (${limits.perMin} طلب/دقيقة). انتظر قليلاً.`);
    }

    if (row) {
      await supabaseAdmin
        .from("ai_rate_limits")
        .update({ request_count: nextCount })
        .eq("id", row.id);
    } else {
      await supabaseAdmin
        .from("ai_rate_limits")
        .insert({ user_id: userId, window_start: windowStart, request_count: weight, token_count: 0 });
    }
  } catch (e: any) {
    // Only throw for the explicit rate-limit message, swallow infra errors.
    if (e?.message?.startsWith?.("تجاوزت")) throw e;
  }
}

export async function hashRequest(taskType: string, payload: unknown): Promise<string> {
  return sha256Hex(taskType + ":" + JSON.stringify(payload).slice(0, 4000));
}
