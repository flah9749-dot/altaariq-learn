import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MapPointSchema = z.object({
  label: z.string(),
  prompt: z.string().optional().default(""),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});

const TemplateInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().min(1),
  points: z.array(MapPointSchema).default([]),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("مسموح للأدمن فقط");
}

export const listMapTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("map_templates")
      .select("id,title,category,description,image_url,data,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertMapTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => TemplateInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.title,
      category: data.category ?? null,
      description: data.description ?? null,
      image_url: data.image_url,
      data: { points: data.points },
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("map_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("map_templates").insert(payload).select("id").single();
    if (error || !row) throw new Error(error?.message ?? "فشل حفظ القالب");
    return { id: row.id };
  });

export const deleteMapTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("map_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
