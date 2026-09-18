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
      ckd_entries: {
        Row: {
          answer: string
          created_at: string
          id: string
          input_mode: string
          question: string
          session_id: string
          speaker: string
          topic: string
          visibility: string
        }
        Insert: {
          answer?: string
          created_at?: string
          id?: string
          input_mode?: string
          question?: string
          session_id: string
          speaker?: string
          topic?: string
          visibility?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          input_mode?: string
          question?: string
          session_id?: string
          speaker?: string
          topic?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ckd_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ckd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ckd_sessions: {
        Row: {
          assistant_name: string
          assistant_role: string
          ckd_stage: string
          code: string
          completed_at: string | null
          consent_recording: boolean
          consent_sharing: boolean
          created_at: string
          id: string
          key_issues: string
          language: string
          patient_label: string
          readiness: string
          stage: string
          updated_at: string
        }
        Insert: {
          assistant_name?: string
          assistant_role?: string
          ckd_stage?: string
          code: string
          completed_at?: string | null
          consent_recording?: boolean
          consent_sharing?: boolean
          created_at?: string
          id?: string
          key_issues?: string
          language?: string
          patient_label: string
          readiness?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          assistant_name?: string
          assistant_role?: string
          ckd_stage?: string
          code?: string
          completed_at?: string | null
          consent_recording?: boolean
          consent_sharing?: boolean
          created_at?: string
          id?: string
          key_issues?: string
          language?: string
          patient_label?: string
          readiness?: string
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      ckd_summaries: {
        Row: {
          caregiver_support: Json
          clinician_summary: string
          confirmed: boolean
          created_at: string
          differing_concerns: Json
          flagged_topics: Json
          id: string
          patient_priorities: Json
          session_id: string
          shared_concerns: Json
          updated_at: string
        }
        Insert: {
          caregiver_support?: Json
          clinician_summary?: string
          confirmed?: boolean
          created_at?: string
          differing_concerns?: Json
          flagged_topics?: Json
          id?: string
          patient_priorities?: Json
          session_id: string
          shared_concerns?: Json
          updated_at?: string
        }
        Update: {
          caregiver_support?: Json
          clinician_summary?: string
          confirmed?: boolean
          created_at?: string
          differing_concerns?: Json
          flagged_topics?: Json
          id?: string
          patient_priorities?: Json
          session_id?: string
          shared_concerns?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ckd_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "ckd_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
