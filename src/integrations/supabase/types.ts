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
      caretakers: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_issues: {
        Row: {
          assigned_at: string | null
          caretaker_id: string | null
          created_at: string
          description: string
          id: string
          owner_id: string
          photo_paths: string[]
          priority: Database["public"]["Enums"]["issue_priority"]
          property_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["issue_status"]
          tenant_id: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          caretaker_id?: string | null
          created_at?: string
          description: string
          id?: string
          owner_id: string
          photo_paths?: string[]
          priority?: Database["public"]["Enums"]["issue_priority"]
          property_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          tenant_id: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          caretaker_id?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          photo_paths?: string[]
          priority?: Database["public"]["Enums"]["issue_priority"]
          property_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["issue_status"]
          tenant_id?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          caretaker_id: string | null
          city: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          monthly_rent_ksh: number
          name: string
          owner_id: string
          property_type: Database["public"]["Enums"]["property_type"]
          status: Database["public"]["Enums"]["property_status"]
          units_count: number
          updated_at: string
        }
        Insert: {
          address: string
          caretaker_id?: string | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent_ksh?: number
          name: string
          owner_id: string
          property_type?: Database["public"]["Enums"]["property_type"]
          status?: Database["public"]["Enums"]["property_status"]
          units_count?: number
          updated_at?: string
        }
        Update: {
          address?: string
          caretaker_id?: string | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          monthly_rent_ksh?: number
          name?: string
          owner_id?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          status?: Database["public"]["Enums"]["property_status"]
          units_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_caretaker_id_fkey"
            columns: ["caretaker_id"]
            isOneToOne: false
            referencedRelation: "caretakers"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          category: Database["public"]["Enums"]["document_category"]
          created_at: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          name: string
          notes: string | null
          owner_id: string
          property_id: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name: string
          notes?: string | null
          owner_id: string
          property_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["document_category"]
          created_at?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          name?: string
          notes?: string | null
          owner_id?: string
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          id: string
          property_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_settings: {
        Row: {
          address: string | null
          business_name: string | null
          created_at: string
          logo_url: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          logo_url?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_name?: string | null
          created_at?: string
          logo_url?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rent_payments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          method: string | null
          notes: string | null
          owner_id: string
          paid_date: string | null
          period_month: number
          period_year: number
          property_id: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string | null
          submitted_method: string | null
          submitted_reference: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          method?: string | null
          notes?: string | null
          owner_id: string
          paid_date?: string | null
          period_month: number
          period_year: number
          property_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          submitted_method?: string | null
          submitted_reference?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          method?: string | null
          notes?: string | null
          owner_id?: string
          paid_date?: string | null
          period_month?: number
          period_year?: number
          property_id?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          submitted_method?: string | null
          submitted_reference?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rent_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          id: string
          owner_id: string
          tenant_id: string
          token: string
          used_at: string | null
          used_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          owner_id: string
          tenant_id: string
          token: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          owner_id?: string
          tenant_id?: string
          token?: string
          used_at?: string | null
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          lease_end: string | null
          lease_start: string | null
          monthly_rent_ksh: number
          notes: string | null
          owner_id: string
          phone: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          unit_id: string | null
          unit_label: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          monthly_rent_ksh?: number
          notes?: string | null
          owner_id: string
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          unit_id?: string | null
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          lease_end?: string | null
          lease_start?: string | null
          monthly_rent_ksh?: number
          notes?: string | null
          owner_id?: string
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          unit_id?: string | null
          unit_label?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          label: string
          monthly_rent_ksh: number
          notes: string | null
          owner_id: string
          property_id: string
          status: Database["public"]["Enums"]["unit_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          monthly_rent_ksh?: number
          notes?: string | null
          owner_id: string
          property_id: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          monthly_rent_ksh?: number
          notes?: string | null
          owner_id?: string
          property_id?: string
          status?: Database["public"]["Enums"]["unit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      ensure_current_month_dues_for_owner: {
        Args: { _owner_id: string }
        Returns: number
      }
      generate_monthly_rent_dues: {
        Args: { _month?: number; _year?: number }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      redeem_tenant_invite: { Args: { _token: string }; Returns: string }
      refresh_overdue_rent_payments: { Args: never; Returns: number }
      submit_rent_payment_intent: {
        Args: {
          _method: string
          _note: string
          _payment_id: string
          _reference: string
        }
        Returns: undefined
      }
      tenant_outstanding_balance: {
        Args: { _tenant_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "landlord"
        | "caretaker"
        | "tenant"
        | "service_provider"
      document_category: "lease" | "inspection" | "certificate" | "other"
      issue_priority: "low" | "medium" | "high"
      issue_status: "open" | "in_progress" | "resolved"
      payment_status: "pending" | "paid" | "late" | "partial"
      property_status: "active" | "draft" | "archived"
      property_type: "apartment" | "house" | "commercial" | "land" | "other"
      tenant_status: "active" | "notice" | "ended"
      unit_status: "vacant" | "occupied"
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
      app_role: [
        "admin",
        "landlord",
        "caretaker",
        "tenant",
        "service_provider",
      ],
      document_category: ["lease", "inspection", "certificate", "other"],
      issue_priority: ["low", "medium", "high"],
      issue_status: ["open", "in_progress", "resolved"],
      payment_status: ["pending", "paid", "late", "partial"],
      property_status: ["active", "draft", "archived"],
      property_type: ["apartment", "house", "commercial", "land", "other"],
      tenant_status: ["active", "notice", "ended"],
      unit_status: ["vacant", "occupied"],
    },
  },
} as const
