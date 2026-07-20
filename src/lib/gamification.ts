import { supabase } from "@/integrations/supabase/client";

export interface AwardPointsArgs {
  studentId: string;
  points: number;
  reason: string;
  kind?: "earn" | "deduct";
  refType?: string | null;
  refId?: string | null;
}

/** Insert a points_log row. Trigger updates student balance/level & sends notification. */
export async function awardPoints(a: AwardPointsArgs) {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from("points_log").insert({
    student_id: a.studentId,
    points: a.points,
    reason: a.reason,
    kind: a.kind ?? (a.points >= 0 ? "earn" : "deduct"),
    ref_type: a.refType ?? null,
    ref_id: a.refId ?? null,
    awarded_by: userData.user?.id ?? null,
  });
  if (error) throw error;
}

/** Apply a predefined rule (e.g. 'exam_passed'). Returns points applied or 0. */
export async function applyPointRule(studentId: string, key: string, extraReason?: string) {
  const { data: rule } = await supabase
    .from("point_rules").select("*").eq("key", key).eq("active", true).maybeSingle();
  if (!rule) return 0;
  await awardPoints({
    studentId,
    points: rule.points,
    reason: extraReason ? `${rule.label} — ${extraReason}` : rule.label,
    kind: rule.kind as "earn" | "deduct",
  });
  return rule.points;
}

export async function awardBadge(studentId: string, badgeId: string) {
  const { error } = await supabase
    .from("student_badges")
    .insert({ student_id: studentId, badge_id: badgeId });
  if (error && !error.message.includes("duplicate")) throw error;
  await applyPointRule(studentId, "badge_earned").catch(() => {});
}

export async function unlockAchievement(studentId: string, achievementId: string, pointsReward = 0) {
  const { error } = await supabase
    .from("student_achievements")
    .insert({ student_id: studentId, achievement_id: achievementId });
  if (error) {
    if (error.message.includes("duplicate")) return false;
    throw error;
  }
  if (pointsReward > 0) {
    await awardPoints({ studentId, points: pointsReward, reason: "مكافأة إنجاز", kind: "earn" });
  }
  return true;
}

/** Evaluate all achievements for a student & unlock new ones. */
export async function checkAchievements(studentId: string) {
  const [achRes, studentRes, examCount, loggedIds] = await Promise.all([
    supabase.from("achievements").select("*").eq("active", true),
    supabase.from("students").select("points, level").eq("id", studentId).maybeSingle(),
    supabase.from("exam_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId).eq("approved", true),
    supabase.from("student_achievements").select("achievement_id").eq("student_id", studentId),
  ]);
  const already = new Set((loggedIds.data ?? []).map((r: any) => r.achievement_id));
  const points = studentRes.data?.points ?? 0;
  const exams = examCount.count ?? 0;
  const unlocked: string[] = [];
  for (const a of achRes.data ?? []) {
    if (already.has(a.id)) continue;
    let meets = false;
    if (a.condition_type === "exam_count") meets = exams >= (a.condition_value ?? 1);
    else if (a.condition_type === "points") meets = points >= (a.condition_value ?? 0);
    else if (a.condition_type === "login_count") meets = true;
    if (meets) {
      await unlockAchievement(studentId, a.id, a.points_reward ?? 0);
      unlocked.push(a.name);
    }
  }
  return unlocked;
}

/** Redeem a reward: RPC-less transactional attempt with balance check. */
export async function redeemReward(studentId: string, rewardId: string) {
  const [{ data: reward }, { data: student }] = await Promise.all([
    supabase.from("reward_catalog").select("*").eq("id", rewardId).maybeSingle(),
    supabase.from("students").select("points").eq("id", studentId).maybeSingle(),
  ]);
  if (!reward || !reward.active) throw new Error("الجائزة غير متاحة");
  if (reward.stock !== null && reward.stock !== undefined && reward.stock <= 0)
    throw new Error("الكمية نفدت");
  const currentPoints = student?.points ?? 0;
  if (currentPoints < reward.points_cost) throw new Error("رصيد النقاط غير كافٍ");

  const { data: redemption, error: rErr } = await supabase.from("reward_redemptions").insert({
    student_id: studentId, reward_id: rewardId, points_spent: reward.points_cost, status: "pending",
  }).select().single();
  if (rErr) throw rErr;

  // Deduct points
  await awardPoints({
    studentId, points: -Math.abs(reward.points_cost),
    reason: `استبدال جائزة: ${reward.title}`, kind: "deduct",
    refType: "reward_redemption", refId: redemption.id,
  });

  // Decrement stock if tracked
  if (reward.stock !== null && reward.stock !== undefined) {
    await supabase.from("reward_catalog").update({ stock: reward.stock - 1 }).eq("id", rewardId);
  }
  return redemption;
}

export function whatsappCongrats(studentName: string, rewardName: string, points: number, level: string | number) {
  return `السلام عليكم،
نبارك للطالب: ${studentName}
لحصوله على: 🏆 ${rewardName}
رصيد النقاط: ⭐ ${points}
المستوى: 🎖️ ${level}
نتمنى له دوام التفوق.`;
}
