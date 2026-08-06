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
      agencies: {
        Row: {
          active: boolean | null
          commission_pct: number | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          nif: string | null
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          commission_pct?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          commission_pct?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string | null
          diff: Json | null
          id: number
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string | null
          diff?: Json | null
          id?: number
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string | null
          diff?: Json | null
          id?: number
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          active: boolean | null
          bank: string | null
          created_at: string | null
          currency: string | null
          iban: string | null
          id: string
          name: string
          opening_balance: number | null
        }
        Insert: {
          active?: boolean | null
          bank?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          name: string
          opening_balance?: number | null
        }
        Update: {
          active?: boolean | null
          bank?: string | null
          created_at?: string | null
          currency?: string | null
          iban?: string | null
          id?: string
          name?: string
          opening_balance?: number | null
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          direction: string | null
          due_date: string | null
          has_invoice: boolean | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          movement_date: string
          no_invoice_reason: string | null
          payment_method_id: string | null
          proposal_id: string | null
          service_expense_id: string | null
          service_order_id: string | null
          settled: boolean | null
          source: string | null
          tvde_shift_id: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          direction?: string | null
          due_date?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          movement_date?: string
          no_invoice_reason?: string | null
          payment_method_id?: string | null
          proposal_id?: string | null
          service_expense_id?: string | null
          service_order_id?: string | null
          settled?: boolean | null
          source?: string | null
          tvde_shift_id?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          direction?: string | null
          due_date?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          movement_date?: string
          no_invoice_reason?: string | null
          payment_method_id?: string | null
          proposal_id?: string | null
          service_expense_id?: string | null
          service_order_id?: string | null
          settled?: boolean | null
          source?: string | null
          tvde_shift_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_service_expense_id_fkey"
            columns: ["service_expense_id"]
            isOneToOne: false
            referencedRelation: "service_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_tvde_shift_id_fkey"
            columns: ["tvde_shift_id"]
            isOneToOne: false
            referencedRelation: "tvde_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          archived: boolean | null
          arrival_date: string | null
          arrival_place: string | null
          arrival_time: string | null
          birth_date: string | null
          city: string | null
          client_number: string | null
          country: string | null
          created_at: string | null
          departure_date: string | null
          departure_place: string | null
          departure_time: string | null
          email: string | null
          emergency_contact: string | null
          id: string
          lead_id: string | null
          lost_reason: string | null
          name: string
          nif: string | null
          notes: string | null
          origin: string | null
          origin_detail: string | null
          passengers: number | null
          phone: string | null
          phone_country: string | null
          status: string | null
          temperature: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          archived?: boolean | null
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          birth_date?: string | null
          city?: string | null
          client_number?: string | null
          country?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          origin?: string | null
          origin_detail?: string | null
          passengers?: number | null
          phone?: string | null
          phone_country?: string | null
          status?: string | null
          temperature?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          archived?: boolean | null
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          birth_date?: string | null
          city?: string | null
          client_number?: string | null
          country?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lead_id?: string | null
          lost_reason?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          origin?: string | null
          origin_detail?: string | null
          passengers?: number | null
          phone?: string | null
          phone_country?: string | null
          status?: string | null
          temperature?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settlements: {
        Row: {
          amount_due_company: number | null
          amount_due_driver: number | null
          commission_amount: number | null
          commission_pct: number | null
          created_at: string | null
          driver_id: string | null
          expenses: number | null
          gross_income: number | null
          id: string
          net_profit: number | null
          notes: string | null
          paid: boolean | null
          paid_at: string | null
          rental_cost: number | null
          vehicle_id: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          amount_due_company?: number | null
          amount_due_driver?: number | null
          commission_amount?: number | null
          commission_pct?: number | null
          created_at?: string | null
          driver_id?: string | null
          expenses?: number | null
          gross_income?: number | null
          id?: string
          net_profit?: number | null
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          rental_cost?: number | null
          vehicle_id?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          amount_due_company?: number | null
          amount_due_driver?: number | null
          commission_amount?: number | null
          commission_pct?: number | null
          created_at?: string | null
          driver_id?: string | null
          expenses?: number | null
          gross_income?: number | null
          id?: string
          net_profit?: number | null
          notes?: string | null
          paid?: boolean | null
          paid_at?: string | null
          rental_cost?: number | null
          vehicle_id?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settlements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settlements_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_documents: {
        Row: {
          amount: number | null
          attachment_url: string | null
          category: string
          created_at: string | null
          created_by: string | null
          currency: string | null
          document_number: string | null
          due_date: string
          entity: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          notes: string | null
          reminder_days: number
          responsible: string | null
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          attachment_url?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          document_number?: string | null
          due_date: string
          entity?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          reminder_days?: number
          responsible?: string | null
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          attachment_url?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          document_number?: string | null
          due_date?: string
          entity?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          reminder_days?: number
          responsible?: string | null
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          doc_footer: string | null
          doc_header_extra: string | null
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
          singleton: boolean | null
          trade_name: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          doc_footer?: string | null
          doc_header_extra?: string | null
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
          singleton?: boolean | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          doc_footer?: string | null
          doc_header_extra?: string | null
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
          singleton?: boolean | null
          trade_name?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      cost_centers: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          active: boolean | null
          address: string | null
          commission_pct: number | null
          contract_type: string | null
          created_at: string | null
          criminal_record: boolean | null
          criminal_record_expiry: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          id_document_expiry: string | null
          id_document_number: string | null
          id_document_type: string | null
          license_expiry: string | null
          license_number: string | null
          nif: string | null
          notes: string | null
          phone: string | null
          tvde_card_expiry: string | null
          tvde_card_number: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          commission_pct?: number | null
          contract_type?: string | null
          created_at?: string | null
          criminal_record?: boolean | null
          criminal_record_expiry?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          id_document_expiry?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          license_expiry?: string | null
          license_number?: string | null
          nif?: string | null
          notes?: string | null
          phone?: string | null
          tvde_card_expiry?: string | null
          tvde_card_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          commission_pct?: number | null
          contract_type?: string | null
          created_at?: string | null
          criminal_record?: boolean | null
          criminal_record_expiry?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          id_document_expiry?: string | null
          id_document_number?: string | null
          id_document_type?: string | null
          license_expiry?: string | null
          license_number?: string | null
          nif?: string | null
          notes?: string | null
          phone?: string | null
          tvde_card_expiry?: string | null
          tvde_card_number?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean | null
          address: string | null
          citizen_card_expiry: string | null
          citizen_card_number: string | null
          created_at: string | null
          criminal_record: boolean | null
          criminal_record_expiry: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          nif: string | null
          phone: string | null
          residence_permit_expiry: string | null
          residence_permit_number: string | null
          role: string | null
          salary: number | null
          salary_pay_day: number | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          citizen_card_expiry?: string | null
          citizen_card_number?: string | null
          created_at?: string | null
          criminal_record?: boolean | null
          criminal_record_expiry?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          nif?: string | null
          phone?: string | null
          residence_permit_expiry?: string | null
          residence_permit_number?: string | null
          role?: string | null
          salary?: number | null
          salary_pay_day?: number | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          citizen_card_expiry?: string | null
          citizen_card_number?: string | null
          created_at?: string | null
          criminal_record?: boolean | null
          criminal_record_expiry?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          nif?: string | null
          phone?: string | null
          residence_permit_expiry?: string | null
          residence_permit_number?: string | null
          role?: string | null
          salary?: number | null
          salary_pay_day?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          active: boolean | null
          amount: number
          category: string | null
          cost_center_id: string | null
          created_at: string | null
          due_day: number | null
          end_date: string | null
          has_invoice: boolean | null
          id: string
          invoice_number: string | null
          name: string
          no_invoice_reason: string | null
          notes: string | null
          recurrence: string
          start_date: string
          supplier_id: string | null
        }
        Insert: {
          active?: boolean | null
          amount?: number
          category?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          due_day?: number | null
          end_date?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_number?: string | null
          name: string
          no_invoice_reason?: string | null
          notes?: string | null
          recurrence?: string
          start_date?: string
          supplier_id?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          category?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          due_day?: number | null
          end_date?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_number?: string | null
          name?: string
          no_invoice_reason?: string | null
          notes?: string | null
          recurrence?: string
          start_date?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          active: boolean | null
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          bank_account_id: string | null
          client_id: string | null
          code: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          deduction_pct: number | null
          description: string | null
          doc_type: Database["public"]["Enums"]["doc_type"] | null
          due_date: string | null
          entity_name: string | null
          entity_nif: string | null
          id: string
          invoice_number: string | null
          issue_date: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          observations: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_method_id: string | null
          photo_url: string | null
          series: string | null
          service_order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          supplier_id: string | null
          total: number | null
          updated_at: string | null
          value_ex_vat: number | null
          vat_amount: number | null
          vat_deductible: number | null
          vat_non_deductible: number | null
          vat_rate_id: string | null
          voucher_code: string | null
        }
        Insert: {
          bank_account_id?: string | null
          client_id?: string | null
          code?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deduction_pct?: number | null
          description?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"] | null
          due_date?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          kind: Database["public"]["Enums"]["invoice_kind"]
          observations?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          photo_url?: string | null
          series?: string | null
          service_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
          value_ex_vat?: number | null
          vat_amount?: number | null
          vat_deductible?: number | null
          vat_non_deductible?: number | null
          vat_rate_id?: string | null
          voucher_code?: string | null
        }
        Update: {
          bank_account_id?: string | null
          client_id?: string | null
          code?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deduction_pct?: number | null
          description?: string | null
          doc_type?: Database["public"]["Enums"]["doc_type"] | null
          due_date?: string | null
          entity_name?: string | null
          entity_nif?: string | null
          id?: string
          invoice_number?: string | null
          issue_date?: string | null
          kind?: Database["public"]["Enums"]["invoice_kind"]
          observations?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method_id?: string | null
          photo_url?: string | null
          series?: string | null
          service_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
          value_ex_vat?: number | null
          vat_amount?: number | null
          vat_deductible?: number | null
          vat_non_deductible?: number | null
          vat_rate_id?: string | null
          voucher_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean
          arrival_date: string | null
          arrival_place: string | null
          arrival_time: string | null
          birth_date: string | null
          client_id: string | null
          client_number: string | null
          code: string | null
          created_at: string | null
          departure_date: string | null
          departure_place: string | null
          departure_time: string | null
          email: string | null
          emergency_contact: string | null
          id: string
          lost_reason: string | null
          name: string
          nif: string | null
          notes: string | null
          origin: string | null
          origin_detail: string | null
          owner_id: string | null
          passengers: number | null
          phone: string | null
          phone_country: string | null
          status: Database["public"]["Enums"]["lead_status"] | null
          temperature: string | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          birth_date?: string | null
          client_id?: string | null
          client_number?: string | null
          code?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lost_reason?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          origin?: string | null
          origin_detail?: string | null
          owner_id?: string | null
          passengers?: number | null
          phone?: string | null
          phone_country?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          temperature?: string | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          birth_date?: string | null
          client_id?: string | null
          client_number?: string | null
          code?: string | null
          created_at?: string | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          lost_reason?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          origin?: string | null
          origin_detail?: string | null
          owner_id?: string | null
          passengers?: number | null
          phone?: string | null
          phone_country?: string | null
          status?: Database["public"]["Enums"]["lead_status"] | null
          temperature?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          created_at: string | null
          expenses: number | null
          gross_profit: number | null
          id: string
          irc_balance_est: number | null
          irc_estimate: number | null
          irc_payments_on_account: number | null
          irc_taxable_base_est: number | null
          irc_withholdings: number | null
          locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          net_profit_est: number | null
          notes: string | null
          operating_profit: number | null
          period: string
          revenue: number | null
          updated_at: string | null
          vat_charged: number | null
          vat_credit_carry: number | null
          vat_deductible: number | null
          vat_non_deductible: number | null
          vat_prev_credit: number | null
          vat_supported: number | null
          vat_to_pay: number | null
        }
        Insert: {
          created_at?: string | null
          expenses?: number | null
          gross_profit?: number | null
          id?: string
          irc_balance_est?: number | null
          irc_estimate?: number | null
          irc_payments_on_account?: number | null
          irc_taxable_base_est?: number | null
          irc_withholdings?: number | null
          locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          net_profit_est?: number | null
          notes?: string | null
          operating_profit?: number | null
          period: string
          revenue?: number | null
          updated_at?: string | null
          vat_charged?: number | null
          vat_credit_carry?: number | null
          vat_deductible?: number | null
          vat_non_deductible?: number | null
          vat_prev_credit?: number | null
          vat_supported?: number | null
          vat_to_pay?: number | null
        }
        Update: {
          created_at?: string | null
          expenses?: number | null
          gross_profit?: number | null
          id?: string
          irc_balance_est?: number | null
          irc_estimate?: number | null
          irc_payments_on_account?: number | null
          irc_taxable_base_est?: number | null
          irc_withholdings?: number | null
          locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          net_profit_est?: number | null
          notes?: string | null
          operating_profit?: number | null
          period?: string
          revenue?: number | null
          updated_at?: string | null
          vat_charged?: number | null
          vat_credit_carry?: number | null
          vat_deductible?: number | null
          vat_non_deductible?: number | null
          vat_prev_credit?: number | null
          vat_supported?: number | null
          vat_to_pay?: number | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          active: boolean | null
          address: string | null
          commission_pct: number | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          nif: string | null
          notes: string | null
          other_type_label: string | null
          partner_type: string | null
          phone: string | null
          phone_country: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          commission_pct?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          nif?: string | null
          notes?: string | null
          other_type_label?: string | null
          partner_type?: string | null
          phone?: string | null
          phone_country?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          commission_pct?: number | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          notes?: string | null
          other_type_label?: string | null
          partner_type?: string | null
          phone?: string | null
          phone_country?: string | null
          type?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          active: boolean | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      products_services: {
        Row: {
          active: boolean | null
          cost_center_id: string | null
          created_at: string | null
          default_price: number | null
          default_vat_rate_id: string | null
          id: string
          kind: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          cost_center_id?: string | null
          created_at?: string | null
          default_price?: number | null
          default_vat_rate_id?: string | null
          id?: string
          kind?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          cost_center_id?: string | null
          created_at?: string | null
          default_price?: number | null
          default_vat_rate_id?: string | null
          id?: string
          kind?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_services_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_services_default_vat_rate_id_fkey"
            columns: ["default_vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      proposal_followups: {
        Row: {
          created_at: string | null
          done: boolean
          due_date: string
          id: string
          note: string | null
          proposal_id: string
        }
        Insert: {
          created_at?: string | null
          done?: boolean
          due_date: string
          id?: string
          note?: string | null
          proposal_id: string
        }
        Update: {
          created_at?: string | null
          done?: boolean
          due_date?: string
          id?: string
          note?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_followups_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_items: {
        Row: {
          description: string | null
          id: string
          product_service_id: string | null
          proposal_id: string
          quantity: number | null
          total: number | null
          unit_price: number | null
          vat_rate_id: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          product_service_id?: string | null
          proposal_id: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
          vat_rate_id?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          product_service_id?: string | null
          proposal_id?: string
          quantity?: number | null
          total?: number | null
          unit_price?: number | null
          vat_rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_items_product_service_id_fkey"
            columns: ["product_service_id"]
            isOneToOne: false
            referencedRelation: "products_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_items_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          approved_at: string | null
          arrival_date: string | null
          arrival_place: string | null
          arrival_time: string | null
          budget_analysis_at: string | null
          budget_analysis_info: string | null
          budget_approved_at: string | null
          budget_receipt_info: string | null
          budget_refusal_reason: string | null
          budget_refused_at: string | null
          budget_status: string | null
          budget_validated_at: string | null
          client_id: string | null
          client_number: string | null
          code: string | null
          created_at: string | null
          created_by: string | null
          days_count: number | null
          departure_date: string | null
          departure_place: string | null
          departure_time: string | null
          description: string | null
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
          proposal_type: string | null
          region_id: string | null
          responsible: string | null
          status: Database["public"]["Enums"]["proposal_status"] | null
          title: string | null
          total_value: number | null
          tour_route_custom: string | null
          tour_route_id: string | null
          updated_at: string | null
          valid_until: string | null
          vat_rate_id: string | null
          voucher_validated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          budget_analysis_at?: string | null
          budget_analysis_info?: string | null
          budget_approved_at?: string | null
          budget_receipt_info?: string | null
          budget_refusal_reason?: string | null
          budget_refused_at?: string | null
          budget_status?: string | null
          budget_validated_at?: string | null
          client_id?: string | null
          client_number?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          days_count?: number | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          description?: string | null
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
          proposal_type?: string | null
          region_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          title?: string | null
          total_value?: number | null
          tour_route_custom?: string | null
          tour_route_id?: string | null
          updated_at?: string | null
          valid_until?: string | null
          vat_rate_id?: string | null
          voucher_validated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          arrival_date?: string | null
          arrival_place?: string | null
          arrival_time?: string | null
          budget_analysis_at?: string | null
          budget_analysis_info?: string | null
          budget_approved_at?: string | null
          budget_receipt_info?: string | null
          budget_refusal_reason?: string | null
          budget_refused_at?: string | null
          budget_status?: string | null
          budget_validated_at?: string | null
          client_id?: string | null
          client_number?: string | null
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          days_count?: number | null
          departure_date?: string | null
          departure_place?: string | null
          departure_time?: string | null
          description?: string | null
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
          proposal_type?: string | null
          region_id?: string | null
          responsible?: string | null
          status?: Database["public"]["Enums"]["proposal_status"] | null
          title?: string | null
          total_value?: number | null
          tour_route_custom?: string | null
          tour_route_id?: string | null
          updated_at?: string | null
          valid_until?: string | null
          vat_rate_id?: string | null
          voucher_validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tour_route_id_fkey"
            columns: ["tour_route_id"]
            isOneToOne: false
            referencedRelation: "tour_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_vat_rate_id_fkey"
            columns: ["vat_rate_id"]
            isOneToOne: false
            referencedRelation: "vat_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          active: boolean | null
          address: string | null
          city: string | null
          created_at: string | null
          cuisine: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          created_at?: string | null
          cuisine?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          city?: string | null
          created_at?: string | null
          cuisine?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      service_closings: {
        Row: {
          amount_received: number | null
          balance_pending: number | null
          closed_at: string | null
          closed_by: string | null
          end_time: string | null
          id: string
          incidents: string | null
          km_final: number | null
          km_initial: number | null
          km_traveled: number | null
          notes: string | null
          payment_method_id: string | null
          received_by: string | null
          sale_value: number | null
          service_order_id: string
          start_time: string | null
        }
        Insert: {
          amount_received?: number | null
          balance_pending?: number | null
          closed_at?: string | null
          closed_by?: string | null
          end_time?: string | null
          id?: string
          incidents?: string | null
          km_final?: number | null
          km_initial?: number | null
          km_traveled?: number | null
          notes?: string | null
          payment_method_id?: string | null
          received_by?: string | null
          sale_value?: number | null
          service_order_id: string
          start_time?: string | null
        }
        Update: {
          amount_received?: number | null
          balance_pending?: number | null
          closed_at?: string | null
          closed_by?: string | null
          end_time?: string | null
          id?: string
          incidents?: string | null
          km_final?: number | null
          km_initial?: number | null
          km_traveled?: number | null
          notes?: string | null
          payment_method_id?: string | null
          received_by?: string | null
          sale_value?: number | null
          service_order_id?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_closings_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_closings_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_expenses: {
        Row: {
          amount: number
          category: string
          cost_center_id: string | null
          created_at: string | null
          description: string | null
          has_invoice: boolean | null
          id: string
          invoice_number: string | null
          no_invoice_reason: string | null
          notes: string | null
          paid_by: string | null
          payment_method_id: string | null
          service_order_id: string | null
          tvde_shift_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_number?: string | null
          no_invoice_reason?: string | null
          notes?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          service_order_id?: string | null
          tvde_shift_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          cost_center_id?: string | null
          created_at?: string | null
          description?: string | null
          has_invoice?: boolean | null
          id?: string
          invoice_number?: string | null
          no_invoice_reason?: string | null
          notes?: string | null
          paid_by?: string | null
          payment_method_id?: string | null
          service_order_id?: string | null
          tvde_shift_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_expenses_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_expenses_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_expenses_tvde_fk"
            columns: ["tvde_shift_id"]
            isOneToOne: false
            referencedRelation: "tvde_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          amount_pending: number | null
          amount_received: number | null
          client_id: string | null
          created_at: string | null
          created_by: string | null
          destination: string | null
          driver_id: string | null
          financial_receipt_note: string | null
          financial_status: string | null
          id: string
          itinerary: string | null
          notes: string | null
          oc_code: string | null
          operation_type: Database["public"]["Enums"]["operation_type"] | null
          origin: string | null
          passengers: number | null
          payment_method_id: string | null
          payment_terms: string | null
          proposal_id: string | null
          received_by: string | null
          sale_value: number | null
          service_code: string | null
          service_date: string
          start_time: string | null
          status: string | null
          updated_at: string | null
          validated_at: string | null
          vehicle_id: string | null
          voucher_code: string | null
        }
        Insert: {
          amount_pending?: number | null
          amount_received?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          financial_receipt_note?: string | null
          financial_status?: string | null
          id?: string
          itinerary?: string | null
          notes?: string | null
          oc_code?: string | null
          operation_type?: Database["public"]["Enums"]["operation_type"] | null
          origin?: string | null
          passengers?: number | null
          payment_method_id?: string | null
          payment_terms?: string | null
          proposal_id?: string | null
          received_by?: string | null
          sale_value?: number | null
          service_code?: string | null
          service_date: string
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          vehicle_id?: string | null
          voucher_code?: string | null
        }
        Update: {
          amount_pending?: number | null
          amount_received?: number | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          financial_receipt_note?: string | null
          financial_status?: string | null
          id?: string
          itinerary?: string | null
          notes?: string | null
          oc_code?: string | null
          operation_type?: Database["public"]["Enums"]["operation_type"] | null
          origin?: string | null
          passengers?: number | null
          payment_method_id?: string | null
          payment_terms?: string | null
          proposal_id?: string | null
          received_by?: string | null
          sale_value?: number | null
          service_code?: string | null
          service_date?: string
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          validated_at?: string | null
          vehicle_id?: string | null
          voucher_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_options: {
        Row: {
          active: boolean
          code: string
          created_at: string | null
          domain: string
          id: string
          label: string
          sort: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string | null
          domain: string
          id?: string
          label: string
          sort?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string | null
          domain?: string
          id?: string
          label?: string
          sort?: number
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          category: string | null
          company_name: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          nif: string | null
          notes: string | null
          phone: string | null
          phone_country: string | null
          products_services: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          category?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
          phone_country?: string | null
          products_services?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          category?: string | null
          company_name?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nif?: string | null
          notes?: string | null
          phone?: string | null
          phone_country?: string | null
          products_services?: string | null
        }
        Relationships: []
      }
      survey_templates: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          questions: Json
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          questions?: Json
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          questions?: Json
        }
        Relationships: []
      }
      surveys: {
        Row: {
          answered_at: string | null
          answers: Json | null
          average_score: number | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          nps_score: number | null
          sent_at: string | null
          service_order_id: string | null
          status: string | null
          template_id: string | null
          token: string
        }
        Insert: {
          answered_at?: string | null
          answers?: Json | null
          average_score?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          nps_score?: number | null
          sent_at?: string | null
          service_order_id?: string | null
          status?: string | null
          template_id?: string | null
          token?: string
        }
        Update: {
          answered_at?: string | null
          answers?: Json | null
          average_score?: number | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          nps_score?: number | null
          sent_at?: string | null
          service_order_id?: string | null
          status?: string | null
          template_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "surveys_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_routes: {
        Row: {
          active: boolean | null
          created_at: string | null
          default_price: number | null
          description: string | null
          duration_hours: number | null
          id: string
          name: string
          region: string | null
          region_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          name: string
          region?: string | null
          region_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          default_price?: number | null
          description?: string | null
          duration_hours?: number | null
          id?: string
          name?: string
          region?: string | null
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_routes_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      tvde_earnings: {
        Row: {
          bonus: number | null
          commissions: number | null
          gross: number | null
          id: string
          net: number | null
          notes: string | null
          other_deductions: number | null
          platform: Database["public"]["Enums"]["tvde_platform"]
          tips: number | null
          tvde_shift_id: string
        }
        Insert: {
          bonus?: number | null
          commissions?: number | null
          gross?: number | null
          id?: string
          net?: number | null
          notes?: string | null
          other_deductions?: number | null
          platform: Database["public"]["Enums"]["tvde_platform"]
          tips?: number | null
          tvde_shift_id: string
        }
        Update: {
          bonus?: number | null
          commissions?: number | null
          gross?: number | null
          id?: string
          net?: number | null
          notes?: string | null
          other_deductions?: number | null
          platform?: Database["public"]["Enums"]["tvde_platform"]
          tips?: number | null
          tvde_shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tvde_earnings_tvde_shift_id_fkey"
            columns: ["tvde_shift_id"]
            isOneToOne: false
            referencedRelation: "tvde_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      tvde_private_jobs: {
        Row: {
          approved_by: string | null
          client_name: string | null
          client_phone: string | null
          destination: string | null
          id: string
          notes: string | null
          oc_code: string | null
          origin: string | null
          payment_method_id: string | null
          payment_status: string | null
          received_by: string | null
          tvde_shift_id: string
          value: number | null
        }
        Insert: {
          approved_by?: string | null
          client_name?: string | null
          client_phone?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          oc_code?: string | null
          origin?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          received_by?: string | null
          tvde_shift_id: string
          value?: number | null
        }
        Update: {
          approved_by?: string | null
          client_name?: string | null
          client_phone?: string | null
          destination?: string | null
          id?: string
          notes?: string | null
          oc_code?: string | null
          origin?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          received_by?: string | null
          tvde_shift_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tvde_private_jobs_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tvde_private_jobs_tvde_shift_id_fkey"
            columns: ["tvde_shift_id"]
            isOneToOne: false
            referencedRelation: "tvde_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      tvde_shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string | null
          driver_id: string | null
          end_time: string | null
          end_time_edited_at: string | null
          end_time_edited_by: string | null
          id: string
          km_final: number | null
          km_initial: number | null
          notes: string | null
          operation_type: Database["public"]["Enums"]["operation_type"] | null
          shift_date: string
          start_time: string | null
          vehicle_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_time?: string | null
          end_time_edited_at?: string | null
          end_time_edited_by?: string | null
          id?: string
          km_final?: number | null
          km_initial?: number | null
          notes?: string | null
          operation_type?: Database["public"]["Enums"]["operation_type"] | null
          shift_date: string
          start_time?: string | null
          vehicle_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_time?: string | null
          end_time_edited_at?: string | null
          end_time_edited_by?: string | null
          id?: string
          km_final?: number | null
          km_initial?: number | null
          notes?: string | null
          operation_type?: Database["public"]["Enums"]["operation_type"] | null
          shift_date?: string
          start_time?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tvde_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tvde_shifts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vat_rates: {
        Row: {
          active: boolean | null
          id: string
          is_exempt: boolean | null
          name: string
          rate: number
        }
        Insert: {
          active?: boolean | null
          id?: string
          is_exempt?: boolean | null
          name: string
          rate: number
        }
        Update: {
          active?: boolean | null
          id?: string
          is_exempt?: boolean | null
          name?: string
          rate?: number
        }
        Relationships: []
      }
      vehicle_drivers: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          is_primary: boolean | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          is_primary?: boolean | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          is_primary?: boolean | null
          vehicle_id?: string
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
          active: boolean | null
          brand: string | null
          color: string | null
          created_at: string | null
          fuel_type: string | null
          id: string
          inspection_expiry: string | null
          insurance_expiry: string | null
          iuc_expiry: string | null
          model: string | null
          notes: string | null
          operates_tvde: boolean | null
          owner_company: string | null
          partner_id: string | null
          plate: string
          rental_weekly_cost: number | null
          seats: number | null
          tvde_license_expiry: string | null
          updated_at: string | null
          usage_type: string | null
          year: number | null
        }
        Insert: {
          active?: boolean | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          iuc_expiry?: string | null
          model?: string | null
          notes?: string | null
          operates_tvde?: boolean | null
          owner_company?: string | null
          partner_id?: string | null
          plate: string
          rental_weekly_cost?: number | null
          seats?: number | null
          tvde_license_expiry?: string | null
          updated_at?: string | null
          usage_type?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean | null
          brand?: string | null
          color?: string | null
          created_at?: string | null
          fuel_type?: string | null
          id?: string
          inspection_expiry?: string | null
          insurance_expiry?: string | null
          iuc_expiry?: string | null
          model?: string | null
          notes?: string | null
          operates_tvde?: boolean | null
          owner_company?: string | null
          partner_id?: string | null
          plate?: string
          rental_weekly_cost?: number | null
          seats?: number | null
          tvde_license_expiry?: string | null
          updated_at?: string | null
          usage_type?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      document_alerts: {
        Row: {
          doc: string | null
          entity: string | null
          entity_id: string | null
          expiry: string | null
          name: string | null
        }
        Relationships: []
      }
      v_weekly_vehicle_result: {
        Row: {
          driver_id: string | null
          expenses: number | null
          gross_income: number | null
          net_profit: number | null
          vehicle_id: string | null
          week_end: string | null
          week_start: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tvde_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tvde_shifts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_module: { Args: { _module: string; _user: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      last_end_km: {
        Args: { _before: string; _vehicle: string }
        Returns: number
      }
      next_client_number: { Args: never; Returns: string }
      next_code: { Args: { prefix: string; seq: unknown }; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "financeiro"
        | "comercial"
        | "operacional"
        | "motorista"
        | "administrativo"
        | "assistente"
      doc_type:
        | "fatura"
        | "fatura_recibo"
        | "recibo"
        | "nota_credito"
        | "nota_debito"
        | "fatura_simplificada"
      invoice_kind: "entrada" | "saida"
      invoice_status:
        | "pendente"
        | "pago"
        | "parcialmente_pago"
        | "vencido"
        | "cancelado"
      lead_status: "novo" | "em_negociacao" | "fechado" | "perdido"
      operation_type: "privado" | "tvde" | "interno" | "outro"
      proposal_status:
        | "rascunho"
        | "enviada"
        | "aprovada"
        | "rejeitada"
        | "convertida"
      service_status:
        | "agendado"
        | "confirmado"
        | "motorista_designado"
        | "em_deslocacao"
        | "cliente_a_bordo"
        | "em_execucao"
        | "finalizado"
        | "cancelado"
        | "nao_realizado"
      tvde_platform: "uber" | "bolt" | "outra"
      vehicle_cost_type: "fixo" | "variavel"
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
        "financeiro",
        "comercial",
        "operacional",
        "motorista",
        "administrativo",
        "assistente",
      ],
      doc_type: [
        "fatura",
        "fatura_recibo",
        "recibo",
        "nota_credito",
        "nota_debito",
        "fatura_simplificada",
      ],
      invoice_kind: ["entrada", "saida"],
      invoice_status: [
        "pendente",
        "pago",
        "parcialmente_pago",
        "vencido",
        "cancelado",
      ],
      lead_status: ["novo", "em_negociacao", "fechado", "perdido"],
      operation_type: ["privado", "tvde", "interno", "outro"],
      proposal_status: [
        "rascunho",
        "enviada",
        "aprovada",
        "rejeitada",
        "convertida",
      ],
      service_status: [
        "agendado",
        "confirmado",
        "motorista_designado",
        "em_deslocacao",
        "cliente_a_bordo",
        "em_execucao",
        "finalizado",
        "cancelado",
        "nao_realizado",
      ],
      tvde_platform: ["uber", "bolt", "outra"],
      vehicle_cost_type: ["fixo", "variavel"],
    },
  },
} as const
