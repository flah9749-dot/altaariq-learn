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

// ─────────────────────────── Hierarchical Tree ───────────────────────────

export type TreeClassRow = {
  class_id: string;
  class_name: string;
  students_count: number;
  active_count: number;
  avg_percentage: number | null;
  attendance_rate: number | null;
  absent_last_count: number;
  top_count: number;
  chronic_absent_count: number;
};

export type TreeGroupRow = Omit<TreeClassRow, "class_id" | "class_name"> & {
  group_id: string;
  group_name: string;
};

export type TreeStudentRow = {
  id: string;
  code: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_whatsapp: string | null;
  status: string;
  points: number;
  level: number;
  last_seen: string | null;
  scheduled_count: number;
  attended_count: number;
  absent_count: number;
  last_exam_id: string | null;
  last_exam_title: string | null;
  last_exam_attended: boolean;
  last_exam_percentage: number | null;
  avg_percentage: number;
};

export const treeListClasses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("admin_tree_classes_overview");
    if (error) throw new Error(error.message);
    return (data ?? []) as TreeClassRow[];
  });

export const treeListGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ class_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_tree_groups_overview", {
      _class_id: data.class_id,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TreeGroupRow[];
  });

export const treeListStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        class_id: z.string().uuid(),
        group_id: z.string().uuid(),
        search: z.string().max(80).optional().nullable(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("admin_tree_students_in_group", {
      _class_id: data.class_id,
      _group_id: data.group_id,
      _limit: data.limit ?? 200,
      _offset: data.offset ?? 0,
      _search: data.search ?? null,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as TreeStudentRow[];
  });

