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
      achievements: {
        Row: {
          active: boolean
          color: string | null
          condition_type: string | null
          condition_value: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          key: string
          name: string
          points_reward: number | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          key: string
          name: string
          points_reward?: number | null
        }
        Update: {
          active?: boolean
          color?: string | null
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          key?: string
          name?: string
          points_reward?: number | null
        }
        Relationships: []
      }
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
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string | null
          hit_count: number | null
          id: string
          last_hit_at: string | null
          model: string | null
          provider: string | null
          result: Json
          task_type: string
          tokens_in: number | null
          tokens_out: number | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model?: string | null
          provider?: string | null
          result: Json
          task_type: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          model?: string | null
          provider?: string | null
          result?: Json
          task_type?: string
          tokens_in?: number | null
          tokens_out?: number | null
        }
        Relationships: []
      }
      ai_extracted_documents: {
        Row: {
          char_count: number | null
          created_at: string
          extracted_text: string
          file_name: string | null
          id: string
          last_used_at: string | null
          mime_type: string | null
          page_count: number | null
          source_hash: string
        }
        Insert: {
          char_count?: number | null
          created_at?: string
          extracted_text: string
          file_name?: string | null
          id?: string
          last_used_at?: string | null
          mime_type?: string | null
          page_count?: number | null
          source_hash: string
        }
        Update: {
          char_count?: number | null
          created_at?: string
          extracted_text?: string
          file_name?: string | null
          id?: string
          last_used_at?: string | null
          mime_type?: string | null
          page_count?: number | null
          source_hash?: string
        }
        Relationships: []
      }
      ai_function_mapping: {
        Row: {
          category: string
          function_key: string
          function_name: string
          id: string
          provider_slug: string
          updated_at: string
        }
        Insert: {
          category: string
          function_key: string
          function_name: string
          id?: string
          provider_slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          function_key?: string
          function_name?: string
          id?: string
          provider_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_providers: {
        Row: {
          avg_latency_ms: number
          created_at: string
          default_model: string | null
          enabled: boolean
          errors_count: number
          id: string
          last_tested_at: string | null
          last_used_at: string | null
          name: string
          priority: number
          requests_count: number
          secret_name: string | null
          slug: string
          test_error: string | null
          test_status: string | null
          updated_at: string
        }
        Insert: {
          avg_latency_ms?: number
          created_at?: string
          default_model?: string | null
          enabled?: boolean
          errors_count?: number
          id?: string
          last_tested_at?: string | null
          last_used_at?: string | null
          name: string
          priority?: number
          requests_count?: number
          secret_name?: string | null
          slug: string
          test_error?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Update: {
          avg_latency_ms?: number
          created_at?: string
          default_model?: string | null
          enabled?: boolean
          errors_count?: number
          id?: string
          last_tested_at?: string | null
          last_used_at?: string | null
          name?: string
          priority?: number
          requests_count?: number
          secret_name?: string | null
          slug?: string
          test_error?: string | null
          test_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_quota_overrides: {
        Row: {
          created_at: string
          feature: string
          id: string
          limit_count: number | null
          max_file_mb: number | null
          max_pages: number | null
          notes: string | null
          period: string | null
          unlimited: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          limit_count?: number | null
          max_file_mb?: number | null
          max_pages?: number | null
          notes?: string | null
          period?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          limit_count?: number | null
          max_file_mb?: number | null
          max_pages?: number | null
          notes?: string | null
          period?: string | null
          unlimited?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_quota_policies: {
        Row: {
          created_at: string
          enabled: boolean
          feature: string
          id: string
          limit_count: number
          max_file_mb: number | null
          max_pages: number | null
          period: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature: string
          id?: string
          limit_count?: number
          max_file_mb?: number | null
          max_pages?: number | null
          period?: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature?: string
          id?: string
          limit_count?: number
          max_file_mb?: number | null
          max_pages?: number | null
          period?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_quota_usage: {
        Row: {
          count: number
          created_at: string
          feature: string
          id: string
          last_used_at: string
          period_key: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          feature: string
          id?: string
          last_used_at?: string
          period_key: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          feature?: string
          id?: string
          last_used_at?: string
          period_key?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_rate_limits: {
        Row: {
          id: string
          request_count: number
          token_count: number
          user_id: string
          window_start: string
        }
        Insert: {
          id?: string
          request_count?: number
          token_count?: number
          user_id: string
          window_start: string
        }
        Update: {
          id?: string
          request_count?: number
          token_count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          cache_hit: boolean
          charged: boolean
          created_at: string
          error: string | null
          estimated_cost: number | null
          feature: string | null
          function_key: string | null
          function_name: string | null
          id: string
          latency_ms: number | null
          model: string | null
          model_tier: string | null
          provider_id: string | null
          success: boolean | null
          task_type: string | null
          tokens_in: number | null
          tokens_out: number | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          charged?: boolean
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          feature?: string | null
          function_key?: string | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          model_tier?: string | null
          provider_id?: string | null
          success?: boolean | null
          task_type?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          charged?: boolean
          created_at?: string
          error?: string | null
          estimated_cost?: number | null
          feature?: string | null
          function_key?: string | null
          function_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          model_tier?: string | null
          provider_id?: string | null
          success?: boolean | null
          task_type?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_used?: number | null
          user_id?: string | null
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
      announcements: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string
          created_at: string
          created_by: string
          ends_at: string | null
          id: string
          image_url: string | null
          priority: string
          published: boolean
          starts_at: string
          target_all: boolean
          target_class_ids: string[] | null
          target_group_ids: string[] | null
          target_student_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body: string
          created_at?: string
          created_by: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: string
          published?: boolean
          starts_at?: string
          target_all?: boolean
          target_class_ids?: string[] | null
          target_group_ids?: string[] | null
          target_student_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          created_by?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          priority?: string
          published?: boolean
          starts_at?: string
          target_all?: boolean
          target_class_ids?: string[] | null
          target_group_ids?: string[] | null
          target_student_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          scopes: Json
          token_hash: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          prefix: string
          revoked_at?: string | null
          scopes?: Json
          token_hash: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          scopes?: Json
          token_hash?: string
        }
        Relationships: []
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
      backups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          size_bytes: number
          status: string
          storage_path: string
          tables: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          size_bytes?: number
          status?: string
          storage_path: string
          tables?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          tables?: Json
        }
        Relationships: []
      }
      badges: {
        Row: {
          active: boolean
          color: string | null
          condition_type: string | null
          condition_value: number | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      competition_participants: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          is_winner: boolean
          rank: number | null
          score: number
          student_id: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          is_winner?: boolean
          rank?: number | null
          score?: number
          student_id: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          is_winner?: boolean
          rank?: number | null
          score?: number
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          active: boolean
          bonus_points: number
          created_at: string
          description: string | null
          ends_at: string
          id: string
          name: string
          prize: string | null
          starts_at: string
          type: string
          updated_at: string
          winners_count: number
        }
        Insert: {
          active?: boolean
          bonus_points?: number
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          name: string
          prize?: string | null
          starts_at: string
          type?: string
          updated_at?: string
          winners_count?: number
        }
        Update: {
          active?: boolean
          bonus_points?: number
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          name?: string
          prize?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
          winners_count?: number
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
          exam_kind: string
          exam_start_notified_at: string | null
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
          exam_kind?: string
          exam_start_notified_at?: string | null
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
          exam_kind?: string
          exam_start_notified_at?: string | null
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
          category: string | null
          created_at: string
          description: string | null
          download_count: number
          id: string
          is_public: boolean
          mime_type: string | null
          name: string
          owner_id: string | null
          path: string
          size: number | null
          target_class_id: string | null
          target_group_id: string | null
        }
        Insert: {
          bucket: string
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          id?: string
          is_public?: boolean
          mime_type?: string | null
          name: string
          owner_id?: string | null
          path: string
          size?: number | null
          target_class_id?: string | null
          target_group_id?: string | null
        }
        Update: {
          bucket?: string
          category?: string | null
          created_at?: string
          description?: string | null
          download_count?: number
          id?: string
          is_public?: boolean
          mime_type?: string | null
          name?: string
          owner_id?: string | null
          path?: string
          size?: number | null
          target_class_id?: string | null
          target_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_target_class_id_fkey"
            columns: ["target_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_target_group_id_fkey"
            columns: ["target_group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
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
      levels: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          icon: string | null
          id: string
          min_points: number
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          min_points?: number
          name: string
          order_index: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          min_points?: number
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: []
      }
      map_exam_markers: {
        Row: {
          created_at: string
          hint: string | null
          id: string
          label: string | null
          number: number
          page_id: string
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          created_at?: string
          hint?: string | null
          id?: string
          label?: string | null
          number?: number
          page_id: string
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          created_at?: string
          hint?: string | null
          id?: string
          label?: string | null
          number?: number
          page_id?: string
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_exam_markers_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "map_exam_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      map_exam_pages: {
        Row: {
          ai_summary: string | null
          clean_image_url: string | null
          created_at: string
          exam_id: string
          id: string
          map_type: string | null
          order_index: number
          original_image_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          clean_image_url?: string | null
          created_at?: string
          exam_id: string
          id?: string
          map_type?: string | null
          order_index?: number
          original_image_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          clean_image_url?: string | null
          created_at?: string
          exam_id?: string
          id?: string
          map_type?: string | null
          order_index?: number
          original_image_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_exam_pages_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      map_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          data: Json
          description: string | null
          id: string
          image_url: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          id?: string
          image_url: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          description?: string | null
          id?: string
          image_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body: string
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_url: string | null
          body: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          id: string
          message_type: string
          read: boolean
          read_at: string | null
          recipient_id: string | null
          reply_to: string | null
          sender_id: string | null
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          message_type?: string
          read?: boolean
          read_at?: string | null
          recipient_id?: string | null
          reply_to?: string | null
          sender_id?: string | null
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_url?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          message_type?: string
          read?: boolean
          read_at?: string | null
          recipient_id?: string | null
          reply_to?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          link: string | null
          meta: Json | null
          read: boolean
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          meta?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          link?: string | null
          meta?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      point_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          kind: string
          label: string
          points: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          kind?: string
          label: string
          points?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          kind?: string
          label?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      points_log: {
        Row: {
          awarded_by: string | null
          created_at: string
          id: string
          kind: string
          points: number
          reason: string | null
          ref_id: string | null
          ref_type: string | null
          student_id: string
        }
        Insert: {
          awarded_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          points: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
          student_id: string
        }
        Update: {
          awarded_by?: string | null
          created_at?: string
          id?: string
          kind?: string
          points?: number
          reason?: string | null
          ref_id?: string | null
          ref_type?: string | null
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
      push_tokens: {
        Row: {
          created_at: string
          id: string
          last_seen: string
          platform: string
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen?: string
          platform?: string
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen?: string
          platform?: string
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          admin_id: string | null
          attachments: Json
          chapter: string | null
          class_ids: string[]
          content: Json
          created_at: string
          description: string | null
          difficulty: string
          entry_type: string
          grade_level: string | null
          group_ids: string[]
          id: string
          points: number
          question_type: string | null
          source: string
          subject: string
          tags: string[]
          title: string
          topic: string | null
          unit: string | null
          updated_at: string
          usage_count: number
          visibility: string
        }
        Insert: {
          admin_id?: string | null
          attachments?: Json
          chapter?: string | null
          class_ids?: string[]
          content?: Json
          created_at?: string
          description?: string | null
          difficulty?: string
          entry_type?: string
          grade_level?: string | null
          group_ids?: string[]
          id?: string
          points?: number
          question_type?: string | null
          source?: string
          subject?: string
          tags?: string[]
          title: string
          topic?: string | null
          unit?: string | null
          updated_at?: string
          usage_count?: number
          visibility?: string
        }
        Update: {
          admin_id?: string | null
          attachments?: Json
          chapter?: string | null
          class_ids?: string[]
          content?: Json
          created_at?: string
          description?: string | null
          difficulty?: string
          entry_type?: string
          grade_level?: string | null
          group_ids?: string[]
          id?: string
          points?: number
          question_type?: string | null
          source?: string
          subject?: string
          tags?: string[]
          title?: string
          topic?: string | null
          unit?: string | null
          updated_at?: string
          usage_count?: number
          visibility?: string
        }
        Relationships: []
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
          map_marker_id: string | null
          map_page_id: string | null
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
          map_marker_id?: string | null
          map_page_id?: string | null
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
          map_marker_id?: string | null
          map_page_id?: string | null
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
          {
            foreignKeyName: "questions_map_marker_id_fkey"
            columns: ["map_marker_id"]
            isOneToOne: false
            referencedRelation: "map_exam_markers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_map_page_id_fkey"
            columns: ["map_page_id"]
            isOneToOne: false
            referencedRelation: "map_exam_pages"
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
      reward_catalog: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          points_cost: number
          stock: number | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          points_cost?: number
          stock?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          points_cost?: number
          stock?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      reward_redemptions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          points_spent: number
          reward_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          points_spent: number
          reward_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          points_spent?: number
          reward_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_student_id_fkey"
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
      student_achievements: {
        Row: {
          achievement_id: string
          id: string
          student_id: string
          unlocked_at: string
        }
        Insert: {
          achievement_id: string
          id?: string
          student_id: string
          unlocked_at?: string
        }
        Update: {
          achievement_id?: string
          id?: string
          student_id?: string
          unlocked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_achievements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          student_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          student_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          archived_at: string | null
          archived_year: string | null
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
          plaintext_password: string | null
          points: number
          seat_number: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          archived_year?: string | null
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
          plaintext_password?: string | null
          points?: number
          seat_number?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          archived_year?: string | null
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
          plaintext_password?: string | null
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
      admin_get_exam_questions: { Args: { _exam_id: string }; Returns: Json }
      dispatch_due_exam_start_notifications: { Args: never; Returns: number }
      get_attempt_review: { Args: { _attempt_id: string }; Returns: Json }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_primary_admin: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          id: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_student_level: {
        Args: { _student_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
