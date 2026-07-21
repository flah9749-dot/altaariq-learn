import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TABLES = [
  "students", "classes", "groups", "exams", "questions", "question_options",
  "exam_attempts", "attempt_answers", "results", "messages", "notifications",
  "announcements", "reward_catalog", "reward_redemptions", "point_rules",
  "points_log", "levels", "badges", "student_badges", "achievements",
  "student_achievements", "competitions", "competition_participants",
  "activity_log", "files", "settings", "ai_providers",
] as const;

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { kind?: "manual" | "daily" | "weekly" | "monthly" }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const dump: Record<string, unknown[]> = {};
    const included: string[] = [];

    for (const table of TABLES) {
      try {
        const { data: rows, error } = await supabase.from(table as any).select("*").limit(10000);
        if (error) continue;
        dump[table] = rows ?? [];
        included.push(table);
      } catch { /* skip */ }
    }

    const json = JSON.stringify({ createdAt: new Date().toISOString(), tables: dump }, null, 2);
    const bytes = new TextEncoder().encode(json);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `backup-${stamp}.json`;
    const path = `${new Date().getFullYear()}/${name}`;

    const { error: upErr } = await supabase.storage
      .from("backups")
      .upload(path, bytes, { contentType: "application/json", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error: insErr } = await supabase
      .from("backups")
      .insert({
        name,
        kind: data.kind ?? "manual",
        size_bytes: bytes.byteLength,
        tables: included,
        storage_path: path,
        status: "ready",
        created_by: userId,
      } as any)
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    return row;
  });

export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("backups").select("storage_path").eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error("النسخة غير موجودة");
    const { data: signed, error: sErr } = await context.supabase.storage
      .from("backups").createSignedUrl((row as any).storage_path, 60 * 10);
    if (sErr || !signed) throw new Error(sErr?.message ?? "تعذّر إنشاء الرابط");
    return { url: signed.signedUrl };
  });

export const deleteBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("backups").select("storage_path").eq("id", data.id).maybeSingle();
    if (row) {
      await context.supabase.storage.from("backups").remove([(row as any).storage_path]);
    }
    const { error } = await context.supabase.from("backups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
