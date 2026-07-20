export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      admins: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      ai_api_keys: {
        Row: {
          created_at: string
          enabled: boolean
          encrypted_key: string
          id: string
          label: string
          provider_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          encrypted_key: string
          id?: string
          label: string
          provider_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          encrypted_key?: string
          id?: string
          label?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_api_keys_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          priority: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          priority?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          priority?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error: string | null
          function_name: string | null
          id: string
          provider_id: string | null
          success: boolean | null
          tokens_used: number | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          function_name?: string | null
          id?: string
          provider_id?: string | null
          success?: boolean | null
          tokens_used?: number | null
        }
        Update: {
          created_at?: string
          error?: string | null
          function_name?: string | null
          id?: string
          provider_id?: string | null
          success?: boolean | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          ai_feedback: string | null
          ai_reasoning: string | null
          ai_suggested_points: number | null
          answer: Json | null
          attempt_id: string
          awarded_points: number | null
          id: string
          is_correct: boolean | null
          question_id: string
          time_spent_sec: number
          updated_at: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_reasoning?: string | null
          ai_suggested_points?: number | null
          answer?: Json | null
          attempt_id: string
          awarded_points?: number | null
          id?: string
          is_correct?: boolean | null
          question_id: string
          time_spent_sec?: number
          updated_at?: string
        }
        Update: {
          ai_feedback?: string | null
          ai_reasoning?: string | null
          ai_suggested_points?: number | null
          answer?: Json | null
          attempt_id?: string
          awarded_points?: number | null
          id?: string
          is_correct?: boolean | null
          question_id?: string
          time_spent_sec?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      exam_attempts: {
        Row: {
          admin_notes: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          device_info: Json | null
          exam_id: string
          grade: string | null
          id: string
          ip: string | null
          leave_events: number
          needs_review: boolean
          percentage: number
          points_awarded: number
          review_marks: Json
          score: number
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          time_spent_sec: number
          total: number
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_info?: Json | null
          exam_id: string
          grade?: string | null
          id?: string
          ip?: string | null
          leave_events?: number
          needs_review?: boolean
          percentage?: number
          points_awarded?: number
          review_marks?: Json
          score?: number
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          time_spent_sec?: number
          total?: number
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          device_info?: Json | null
          exam_id?: string
          grade?: string | null
          id?: string
          ip?: string | null
          leave_events?: number
          needs_review?: boolean
          percentage?: number
          points_awarded?: number
          review_marks?: Json
          score?: number
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          time_spent_sec?: number
          total?: number
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          anti_cheat: Json
          attempts_allowed: number
          class_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          ends_at: string | null
          group_ids: string[]
          id: string
          num_variants: number
          published: boolean
          show_result_mode: string
          shuffle_options: boolean
          shuffle_questions: boolean
          starts_at: string | null
          status: string
          subject: string | null
          title: string
          total_score: number
          updated_at: string
        }
        Insert: {
          anti_cheat?: Json
          attempts_allowed?: number
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          group_ids?: string[]
          id?: string
          num_variants?: number
          published?: boolean
          show_result_mode?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          starts_at?: string | null
          status?: string
          subject?: string | null
          title: string
          total_score?: number
          updated_at?: string
        }
        Update: {
          anti_cheat?: Json
          attempts_allowed?: number
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          ends_at?: string | null
          group_ids?: string[]
          id?: string
          num_variants?: number
          published?: boolean
          show_result_mode?: string
          shuffle_options?: boolean
          shuffle_questions?: boolean
          starts_at?: string | null
          status?: string
          subject?: string | null
          title?: string
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          owner_id: string | null
          path: string
          size: number | null
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          owner_id?: string | null
          path: string
          size?: number | null
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          owner_id?: string | null
          path?: string
          size?: number | null
        }
        Relationships: []
      }
      groups: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      points_log: {
        Row: {
          created_at: string
          id: string
          points: number
          reason: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points: number
          reason?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: number
          reason?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          id: string
          image_url: string | null
          is_correct: boolean
          match_key: string | null
          order_index: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          image_url?: string | null
          is_correct?: boolean
          match_key?: string | null
          order_index?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          image_url?: string | null
          is_correct?: boolean
          match_key?: string | null
          order_index?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          correct_answer: Json | null
          created_at: string
          difficulty: string | null
          exam_id: string
          explanation: string | null
          file_url: string | null
          id: string
          image_url: string | null
          order_index: number
          points: number
          suggested_time_sec: number | null
          text: string
          type: string
          updated_at: string
        }
        Insert: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          exam_id: string
          explanation?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          order_index?: number
          points?: number
          suggested_time_sec?: number | null
          text: string
          type: string
          updated_at?: string
        }
        Update: {
          correct_answer?: Json | null
          created_at?: string
          difficulty?: string | null
          exam_id?: string
          explanation?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          order_index?: number
          points?: number
          suggested_time_sec?: number | null
          text?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          score: number
          student_id: string
          total: number
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          score?: number
          student_id: string
          total?: number
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          score?: number
          student_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          points: number
          student_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          points?: number
          student_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          points?: number
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string | null
          avatar_url: string | null
          birth_date: string | null
          class_id: string | null
          code: string
          created_at: string
          full_name: string
          gender: string | null
          group_id: string | null
          id: string
          is_online: boolean
          last_seen: string | null
          level: number
          notes: string | null
          parent_name: string | null
          parent_phone: string | null
          parent_whatsapp: string | null
          phone: string | null
          points: number
          seat_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          class_id?: string | null
          code: string
          created_at?: string
          full_name: string
          gender?: string | null
          group_id?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string | null
          level?: number
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_whatsapp?: string | null
          phone?: string | null
          points?: number
          seat_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          class_id?: string | null
          code?: string
          created_at?: string
          full_name?: string
          gender?: string | null
          group_id?: string | null
          id?: string
          is_online?: boolean
          last_seen?: string | null
          level?: number
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_whatsapp?: string | null
          phone?: string | null
          points?: number
          seat_number?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
