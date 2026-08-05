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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string | null
          birth_date: string | null
          city: string | null
          client_number: string | null
          country: string | null
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          id: string
          lead_id: string | null
          name: string
          nif: string | null
          notes: string | null
          phone: string | null
          phone_country: string | null
          postal_code: string | null
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          client_number?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lead_id?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
          phone_country?: string | null
          postal_code?: string | null
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          city?: string | null
          client_number?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
          phone_country?: string | null
          postal_code?: string | null
        }
        Relationships: []
      }
      company_documents: {
        Row: {
          category: string
          created_at: string | null
          currency: string | null
          due_date: string | null
          entity: string
          id: string
          notes: string | null
          reminder_days: number | null
          status: string | null
          title: string
        }
        Insert: {
          category: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          entity: string
          id?: string
          notes?: string | null
          reminder_days?: number | null
          status?: string | null
          title: string
        }
        Update: {
          category?: string
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          entity?: string
          id?: string
          notes?: string | null
          reminder_days?: number | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          facebook_url: string | null
          iban: string | null
          id: string
          instagram_qr_url: string | null
          instagram_url: string | null
          invoice_footer: string | null
          legal_name: string | null
          logo_url: string | null
          name: string
          nif: string | null
          phone: string | null
          postal_code: string | null
          proposal_general_conditions: string | null
          trade_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          iban?: string | null
          id?: string
          instagram_qr_url?: string | null
          instagram_url?: string | null
          invoice_footer?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          proposal_general_conditions?: string | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          facebook_url?: string | null
          iban?: string | null
          id?: string
          instagram_qr_url?: string | null
          instagram_url?: string | null
          invoice_footer?: string | null
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          nif?: string | null
          phone?: string | null
          postal_code?: string | null
          proposal_general_conditions?: string | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          cost_center_id: string | null
          created_at: string | null
          doc_type: string | null
          due_date: string | null
          entity_name: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          kind: string | null
          payment_method_id: string | null
          series: string | null
          status: string | null
          total_value: number | null
          vat_rate_id: string | null
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string | null
          doc_type?: string | null
          due_date?: string | null
          entity_name?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          kind?: string | null
          payment_method_id?: string | null
          series?: string | null
          status?: string | null
          total_value?: number | null
          vat_rate_id?: string | null
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string | null
          doc_type?: string | null
          due_date?: string | null
          entity_name?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          kind?: string | null
          payment_method_id?: string | null
          series?: string | null
          status?: string | null
          total_value?: number | null
          vat_rate_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          arrival_date: string | null
          arrival_place: string | null
          arrival_time: string | null
          budget_approved_at: string | null
          client_id: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          departure_date: string | null
          departure_place: string | null
          departure_time: string | null
          descriptive: string | null
          id: string
          itinerary: Json | null
          itinerary_end: string | null
          itinerary_start: string | null
          lead_id: string | null
          passengers: number | null
          payment_stages: Json | null
          payment_terms: string | null
          private_service_text: string | null
          proposal_kind: string | null
          region_id: string | null
          responsible: string | null
          status: string | null
          title: string | null
          total_value: number | null
          tour_route_id: string | null
          voucher_day_notes: Json | null
          voucher_final_note: string | null
          voucher_validated_at: string | null
        }
        Insert: {
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          budget_approved_at?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          descriptive?: string | null
          id?: string
          itinerary?: Json | null
          itinerary_end?: string | null
          itinerary_start?: string | null
          lead_id?: string | null
          passengers?: number | null
          payment_stages?: Json | null
          payment_terms?: string | null
          private_service_text?: string | null
          proposal_kind?: string | null
          region_id?: string | null
          responsible?: string | null
          status?: string | null
          title?: string | null
          total_value?: number | null
          tour_route_id?: string | null
          voucher_day_notes?: Json | null
          voucher_final_note?: string | null
          voucher_validated_at?: string | null
        }
        Update: {
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          budget_approved_at?: string | null
          client_id?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          descriptive?: string | null
          id?: string
          itinerary?: Json | null
          itinerary_end?: string | null
          itinerary_start?: string | null
          lead_id?: string | null
          passengers?: number | null
          payment_stages?: Json | null
          payment_terms?: string | null
          private_service_text?: string | null
          proposal_kind?: string | null
          region_id?: string | null
          responsible?: string | null
          status?: string | null
          title?: string | null
          total_value?: number | null
          tour_route_id?: string | null
          voucher_day_notes?: Json | null
          voucher_final_note?: string | null
          voucher_validated_at?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          status: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      vat_rates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          rate: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          rate: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          rate?: number
        }
        Relationships: []
      }
      vehicle_drivers: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          is_primary: boolean | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_primary?: boolean | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_primary?: boolean | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
    Enums: {},
  },
} as const
