import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StudentOverviewRow = {
  id: string;
  code: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_whatsapp: string | null;
  status: string;
  class_id: string | null;
  class_name: string | null;
  group_id: string | null;
  group_name: string | null;
  points: number;
  level: number;
  last_seen: string | null;
  created_at: string;
  scheduled_count: number;
  attended_count: number;
  absent_count: number;
  last_exam_id: string | null;
  last_exam_title: string | null;
  last_exam_attended: boolean;
  last_exam_percentage: number | null;
  avg_percentage: number;
};

export const getStudentsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        class_id: z.string().uuid().nullable().optional(),
        group_id: z.string().uuid().nullable().optional(),
        status: z.enum(["active", "suspended"]).nullable().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_students_overview", {
      _class_id: data.class_id ?? undefined,
      _group_id: data.group_id ?? undefined,
      _status: data.status ?? undefined,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as StudentOverviewRow[];
  });
