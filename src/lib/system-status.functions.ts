import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Check = { name: string; ok: boolean; latencyMs: number; detail?: string };

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; detail?: string }> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, detail: e?.message?.slice(0, 200) ?? "خطأ" };
  }
}

export const systemHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const checks: Check[] = [];

    const db = await timed(async () => {
      const { error } = await supabase.from("students").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    });
    checks.push({ name: "قاعدة البيانات", ok: db.ok, latencyMs: db.ms, detail: db.detail });

    const auth = await timed(async () => {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
    });
    checks.push({ name: "المصادقة (Auth)", ok: auth.ok, latencyMs: auth.ms, detail: auth.detail });

    const storage = await timed(async () => {
      const { error } = await supabase.storage.from("avatars").list("", { limit: 1 });
      if (error) throw error;
    });
    checks.push({ name: "التخزين (Storage)", ok: storage.ok, latencyMs: storage.ms, detail: storage.detail });

    const backupsBucket = await timed(async () => {
      const { error } = await supabase.storage.from("backups").list("", { limit: 1 });
      if (error) throw error;
    });
    checks.push({ name: "مخزن النسخ الاحتياطية", ok: backupsBucket.ok, latencyMs: backupsBucket.ms, detail: backupsBucket.detail });

    const aiCheck = await timed(async () => {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("LOVABLE_API_KEY غير مضبوط");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "Lovable-API-Key": key },
          body: JSON.stringify({ model: "google/gemini-3.5-flash", messages: [{ role: "user", content: "ping" }] }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`);
        }
      } finally { clearTimeout(timer); }
    });
    checks.push({ name: "بوابة الذكاء الاصطناعي", ok: aiCheck.ok, latencyMs: aiCheck.ms, detail: aiCheck.detail });

    const notifs = await timed(async () => {
      const { error } = await supabase.from("notifications").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw error;
    });
    checks.push({ name: "الإشعارات", ok: notifs.ok, latencyMs: notifs.ms, detail: notifs.detail });

    const overallOk = checks.every((c) => c.ok);
    return { checks, overallOk, checkedAt: new Date().toISOString() };
  });
