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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: string
          ip: unknown
          meta: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip?: unknown
          meta?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip?: unknown
          meta?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_payments: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          kind: string
          masked_card: string | null
          pack_code: string | null
          paid_at: string | null
          parent_id: string | null
          plan_code: string | null
          provider_payment_id: string | null
          segments: number | null
          status: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          kind: string
          masked_card?: string | null
          pack_code?: string | null
          paid_at?: string | null
          parent_id?: string | null
          plan_code?: string | null
          provider_payment_id?: string | null
          segments?: number | null
          status?: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          kind?: string
          masked_card?: string | null
          pack_code?: string | null
          paid_at?: string | null
          parent_id?: string | null
          plan_code?: string | null
          provider_payment_id?: string | null
          segments?: number | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_payments_pack_code_fkey"
            columns: ["pack_code"]
            isOneToOne: false
            referencedRelation: "sms_packs"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "billing_payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "billing_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_payments_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "billing_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_charges: {
        Row: {
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          price_minor: number
          tenant_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          price_minor: number
          tenant_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          price_minor?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_charges_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_charges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_imports: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string | null
          id: string
          rows_imported: number
          rows_skipped: number
          rows_total: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          rows_imported: number
          rows_skipped: number
          rows_total: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string | null
          id?: string
          rows_imported?: number
          rows_skipped?: number
          rows_total?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_imports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_items: {
        Row: {
          active: boolean
          blocked_until: string
          booking_id: string
          buffer_min_snapshot: number
          created_at: string
          duration_min_snapshot: number
          ends_at: string
          id: string
          name_snapshot: string
          price_minor_snapshot: number
          price_type_snapshot: string
          resource_id: string | null
          service_id: string | null
          sort_order: number
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          active?: boolean
          blocked_until: string
          booking_id: string
          buffer_min_snapshot?: number
          created_at?: string
          duration_min_snapshot: number
          ends_at: string
          id?: string
          name_snapshot: string
          price_minor_snapshot: number
          price_type_snapshot: string
          resource_id?: string | null
          service_id?: string | null
          sort_order?: number
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          active?: boolean
          blocked_until?: string
          booking_id?: string
          buffer_min_snapshot?: number
          created_at?: string
          duration_min_snapshot?: number
          ends_at?: string
          id?: string
          name_snapshot?: string
          price_minor_snapshot?: number
          price_type_snapshot?: string
          resource_id?: string | null
          service_id?: string | null
          sort_order?: number
          staff_id?: string
          starts_at?: string
          tenant_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_items_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_items_resource_id_tenant_id_fkey"
            columns: ["resource_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_items_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_items_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_manage_tokens: {
        Row: {
          booking_id: string
          created_at: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_manage_tokens_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          meta: Json
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          booking_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          meta?: Json
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          booking_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          meta?: Json
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "booking_status_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancel_reason: string | null
          client_comment: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposit_status: string
          discount_minor: number
          ends_at: string
          id: string
          internal_note: string | null
          location_id: string | null
          paid_minor: number
          recurrence_id: string | null
          source: string
          starts_at: string
          status: string
          tenant_id: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          client_comment?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_status?: string
          discount_minor?: number
          ends_at: string
          id?: string
          internal_note?: string | null
          location_id?: string | null
          paid_minor?: number
          recurrence_id?: string | null
          source?: string
          starts_at: string
          status?: string
          tenant_id: string
          total_minor?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          client_comment?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_status?: string
          discount_minor?: number
          ends_at?: string
          id?: string
          internal_note?: string | null
          location_id?: string | null
          paid_minor?: number
          recurrence_id?: string | null
          source?: string
          starts_at?: string
          status?: string
          tenant_id?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_recurrence_fk"
            columns: ["recurrence_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "recurrences"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_photos: {
        Row: {
          created_at: string
          id: string
          path: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_photos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consents: {
        Row: {
          at: string
          channel: string
          client_id: string
          granted: boolean
          id: string
          purpose: string
          recorded_by: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          at?: string
          channel: string
          client_id: string
          granted: boolean
          id?: string
          purpose?: string
          recorded_by?: string | null
          source: string
          tenant_id: string
        }
        Update: {
          at?: string
          channel?: string
          client_id?: string
          granted?: boolean
          id?: string
          purpose?: string
          recorded_by?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_fields: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          options: string[]
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          options?: string[]
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          options?: string[]
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          anonymized_at: string | null
          birthday: string | null
          blocked_online: boolean
          created_at: string
          created_by: string | null
          custom: Json
          email: string | null
          first_name: string
          gender: string | null
          id: string
          important_note: string | null
          last_name: string | null
          no_show_count: number
          notes: string | null
          phone_e164: string | null
          preferred_staff_id: string | null
          source: string | null
          tags: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          anonymized_at?: string | null
          birthday?: string | null
          blocked_online?: boolean
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          important_note?: string | null
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone_e164?: string | null
          preferred_staff_id?: string | null
          source?: string | null
          tags?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          anonymized_at?: string | null
          birthday?: string | null
          blocked_online?: boolean
          created_at?: string
          created_by?: string | null
          custom?: Json
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          important_note?: string | null
          last_name?: string | null
          no_show_count?: number
          notes?: string | null
          phone_e164?: string | null
          preferred_staff_id?: string | null
          source?: string | null
          tags?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_staff_id_tenant_id_fkey"
            columns: ["preferred_staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      closures: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string | null
          reason: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          reason?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          reason?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "closures_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "closures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dental_notes: {
        Row: {
          author_id: string | null
          body: string
          booking_id: string | null
          client_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          booking_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          booking_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dental_notes_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "dental_notes_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "dental_notes_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "dental_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          revoked_at: string | null
          role: string
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role: string
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          revoked_at?: string | null
          role?: string
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_hours: {
        Row: {
          created_at: string
          end_time: string
          id: string
          location_id: string
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_hours_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "location_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          role: string
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_staff_fk"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          booking_id: string
          kind: string
          read_at: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          booking_id: string
          kind: string
          read_at?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          booking_id?: string
          kind?: string
          read_at?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "notification_reads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          booking_id: string
          created_at: string
          id: string
          kind: string
          tenant_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          id?: string
          kind: string
          tenant_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          id?: string
          kind?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone_e164: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone_e164: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone_e164?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "otp_codes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_passes: {
        Row: {
          expires_at: string
          phone_e164: string
          tenant_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          expires_at: string
          phone_e164: string
          tenant_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          expires_at?: string
          phone_e164?: string
          tenant_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_passes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_adjustments: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          id: string
          kind: string
          month: string
          note: string | null
          staff_id: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          month: string
          note?: string | null
          staff_id: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          month?: string
          note?: string | null
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_adjustments_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "pay_adjustments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          booking_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string
          provider: string | null
          provider_ref: string | null
          status: string
          tenant_id: string
          tip_minor: number
          tip_staff_id: string | null
        }
        Insert: {
          amount_minor: number
          booking_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          tenant_id: string
          tip_minor?: number
          tip_staff_id?: string | null
        }
        Update: {
          amount_minor?: number
          booking_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          provider?: string | null
          provider_ref?: string | null
          status?: string
          tenant_id?: string
          tip_minor?: number
          tip_staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tip_staff_id_tenant_id_fkey"
            columns: ["tip_staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          id: string
          method: string
          month: string
          note: string | null
          paid_on: string
          staff_id: string
          tenant_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: string
          month: string
          note?: string | null
          paid_on: string
          staff_id: string
          tenant_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string
          month?: string
          note?: string | null
          paid_on?: string
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          code: string
          features: string[]
          max_staff: number | null
          name: string
          price_minor: number
          sms_per_month: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          features?: string[]
          max_staff?: number | null
          name: string
          price_minor?: number
          sms_per_month?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          features?: string[]
          max_staff?: number | null
          name?: string
          price_minor?: number
          sms_per_month?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_events: {
        Row: {
          at: string
          key: string
        }
        Insert: {
          at?: string
          key: string
        }
        Update: {
          at?: string
          key?: string
        }
        Relationships: []
      }
      recurrences: {
        Row: {
          created_at: string
          created_by: string | null
          every_weeks: number
          id: string
          occurrences: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          every_weeks: number
          id?: string
          occurrences: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          every_weeks?: number
          id?: string
          occurrences?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurrences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          name: string
          sort_order: number
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          name: string
          sort_order?: number
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          name?: string
          sort_order?: number
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "resources_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          booking_id: string
          created_at: string
          expires_at: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          expires_at?: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          expires_at?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          staff_id: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          booking_id: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          staff_id?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          booking_id?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          staff_id?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "reviews_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "reviews_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "reviews_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_minor?: number
          service_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "service_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          id: string
          name_i18n: Json
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_i18n: Json
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_i18n?: Json
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min: number
          id?: string
          name_i18n: Json
          price_minor: number
          service_id: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_minor?: number
          service_id?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "service_variants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          bookable_online: boolean
          buffer_after_min: number
          category_id: string | null
          color: string | null
          created_at: string
          currency: string
          deposit_type: string
          deposit_value: number
          description_i18n: Json
          duration_min: number
          id: string
          name_i18n: Json
          price_max_minor: number | null
          price_minor: number
          price_type: string
          resource_type: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description_i18n?: Json
          duration_min: number
          id?: string
          name_i18n: Json
          price_max_minor?: number | null
          price_minor: number
          price_type?: string
          resource_type?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bookable_online?: boolean
          buffer_after_min?: number
          category_id?: string | null
          color?: string | null
          created_at?: string
          currency?: string
          deposit_type?: string
          deposit_value?: number
          description_i18n?: Json
          duration_min?: number
          id?: string
          name_i18n?: Json
          price_max_minor?: number | null
          price_minor?: number
          price_type?: string
          resource_type?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_tenant_id_fkey"
            columns: ["category_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: string
          message_id: string | null
          note: string | null
          reason: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          message_id?: string | null
          note?: string | null
          reason: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          message_id?: string | null
          note?: string | null
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_credit_ledger_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "sms_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_messages: {
        Row: {
          attempts: number
          body: string
          booking_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error_code: string | null
          id: string
          idempotency_key: string
          kind: string
          provider: string | null
          provider_ref: string | null
          segments: number
          send_after: string
          sent_at: string | null
          status: string
          tenant_id: string
          to_phone: string
          type: string
        }
        Insert: {
          attempts?: number
          body: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error_code?: string | null
          id?: string
          idempotency_key: string
          kind: string
          provider?: string | null
          provider_ref?: string | null
          segments: number
          send_after?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          to_phone: string
          type: string
        }
        Update: {
          attempts?: number
          body?: string
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          delivered_at?: string | null
          error_code?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          provider?: string | null
          provider_ref?: string | null
          segments?: number
          send_after?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          to_phone?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "sms_messages_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "sms_messages_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "sms_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_packs: {
        Row: {
          active: boolean
          code: string
          price_minor: number
          segments: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          price_minor: number
          segments: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          price_minor?: number
          segments?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          body: string
          id: string
          locale: string
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          locale: string
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          locale?: string
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          bio: string | null
          bookable_online: boolean
          color: string
          commission_pct: number
          created_at: string
          display_name: string
          email: string | null
          id: string
          location_id: string | null
          phone: string | null
          photo_path: string | null
          position: string | null
          position_type: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bio?: string | null
          bookable_online?: boolean
          color?: string
          commission_pct?: number
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          photo_path?: string | null
          position?: string | null
          position_type?: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bio?: string | null
          bookable_online?: boolean
          color?: string
          commission_pct?: number
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          location_id?: string | null
          phone?: string | null
          photo_path?: string | null
          position?: string | null
          position_type?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_id_tenant_id_fkey"
            columns: ["location_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay: {
        Row: {
          created_at: string
          salary_minor: number
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          salary_minor?: number
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          salary_minor?: number
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_pay_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_rates: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          pct: number
          service_id: string | null
          staff_id: string
          tenant_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          pct: number
          service_id?: string | null
          staff_id: string
          tenant_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          pct?: number
          service_id?: string | null
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_rates_category_id_tenant_id_fkey"
            columns: ["category_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_pay_rates_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_pay_rates_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_pay_rates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedule_overrides: {
        Row: {
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_day_off: boolean
          staff_id: string
          start_time: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          staff_id: string
          start_time?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_day_off?: boolean
          staff_id?: string
          start_time?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedule_overrides_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_schedule_overrides_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_schedules: {
        Row: {
          created_at: string
          end_time: string
          id: string
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          staff_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          created_at: string
          duration_min_override: number | null
          id: string
          price_minor_override: number | null
          service_id: string
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_min_override?: number | null
          id?: string
          price_minor_override?: number | null
          service_id: string
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_min_override?: number | null
          id?: string
          price_minor_override?: number | null
          service_id?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "staff_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_grants: {
        Row: {
          created_at: string
          expires_at: string
          granted_by: string | null
          id: string
          revoked_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          granted_by?: string | null
          id?: string
          revoked_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_grants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          admins_see_revenue: boolean
          cancel_window_min: number
          created_at: string
          email: string | null
          max_days_ahead: number
          min_notice_min: number
          notify_online_managers: boolean
          notify_online_staff: boolean
          notify_overdue_managers: boolean
          notify_overdue_staff: boolean
          online_max_upcoming: number
          online_otp_required: boolean
          online_requires_approval: boolean
          online_show_prices: boolean
          phone: string | null
          quiet_end: string
          quiet_start: string
          reminder_24h: boolean
          reminder_2h: boolean
          reviews_ask: boolean
          reviews_delay_hours: number
          reviews_public: boolean
          segment_at_risk_days: number
          segment_lost_days: number
          segment_vip_visits: number
          site_about: Json
          site_cover_path: string | null
          site_facebook: string | null
          site_instagram: string | null
          site_logo_path: string | null
          site_theme: string
          slot_step_min: number
          sms_low_balance: number
          sms_on_cancel: boolean
          sms_on_confirm: boolean
          sms_on_reschedule: boolean
          sms_sender_name: string | null
          sms_sender_status: string
          staff_sees_all_bookings: boolean
          staff_sees_all_clients: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admins_see_revenue?: boolean
          cancel_window_min?: number
          created_at?: string
          email?: string | null
          max_days_ahead?: number
          min_notice_min?: number
          notify_online_managers?: boolean
          notify_online_staff?: boolean
          notify_overdue_managers?: boolean
          notify_overdue_staff?: boolean
          online_max_upcoming?: number
          online_otp_required?: boolean
          online_requires_approval?: boolean
          online_show_prices?: boolean
          phone?: string | null
          quiet_end?: string
          quiet_start?: string
          reminder_24h?: boolean
          reminder_2h?: boolean
          reviews_ask?: boolean
          reviews_delay_hours?: number
          reviews_public?: boolean
          segment_at_risk_days?: number
          segment_lost_days?: number
          segment_vip_visits?: number
          site_about?: Json
          site_cover_path?: string | null
          site_facebook?: string | null
          site_instagram?: string | null
          site_logo_path?: string | null
          site_theme?: string
          slot_step_min?: number
          sms_low_balance?: number
          sms_on_cancel?: boolean
          sms_on_confirm?: boolean
          sms_on_reschedule?: boolean
          sms_sender_name?: string | null
          sms_sender_status?: string
          staff_sees_all_bookings?: boolean
          staff_sees_all_clients?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admins_see_revenue?: boolean
          cancel_window_min?: number
          created_at?: string
          email?: string | null
          max_days_ahead?: number
          min_notice_min?: number
          notify_online_managers?: boolean
          notify_online_staff?: boolean
          notify_overdue_managers?: boolean
          notify_overdue_staff?: boolean
          online_max_upcoming?: number
          online_otp_required?: boolean
          online_requires_approval?: boolean
          online_show_prices?: boolean
          phone?: string | null
          quiet_end?: string
          quiet_start?: string
          reminder_24h?: boolean
          reminder_2h?: boolean
          reviews_ask?: boolean
          reviews_delay_hours?: number
          reviews_public?: boolean
          segment_at_risk_days?: number
          segment_lost_days?: number
          segment_vip_visits?: number
          site_about?: Json
          site_cover_path?: string | null
          site_facebook?: string | null
          site_instagram?: string | null
          site_logo_path?: string | null
          site_theme?: string
          slot_step_min?: number
          sms_low_balance?: number
          sms_on_cancel?: boolean
          sms_on_confirm?: boolean
          sms_on_reschedule?: boolean
          sms_sender_name?: string | null
          sms_sender_status?: string
          staff_sees_all_bookings?: boolean
          staff_sees_all_clients?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          autopay: boolean
          created_at: string
          created_by: string | null
          currency: string
          deletion_due_at: string | null
          deletion_requested_at: string | null
          id: string
          locale_default: string
          name: string
          paid_until: string | null
          plan: string
          settings: Json
          slug: string
          status: string
          timezone: string
          trial_ends_at: string
          type: string
          updated_at: string
        }
        Insert: {
          autopay?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          deletion_due_at?: string | null
          deletion_requested_at?: string | null
          id?: string
          locale_default?: string
          name: string
          paid_until?: string | null
          plan?: string
          settings?: Json
          slug: string
          status?: string
          timezone?: string
          trial_ends_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          autopay?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          deletion_due_at?: string | null
          deletion_requested_at?: string | null
          id?: string
          locale_default?: string
          name?: string
          paid_until?: string | null
          plan?: string
          settings?: Json
          slug?: string
          status?: string
          timezone?: string
          trial_ends_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_fk"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["code"]
          },
        ]
      }
      time_off: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          note: string | null
          reason: string
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          note?: string | null
          reason?: string
          staff_id: string
          starts_at: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          note?: string | null
          reason?: string
          staff_id?: string
          starts_at?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "time_off_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          ends_at: string
          id: string
          note: string | null
          reason: string
          staff_id: string
          starts_at: string
          status: string
          tenant_id: string
          time_off_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at: string
          id?: string
          note?: string | null
          reason?: string
          staff_id: string
          starts_at: string
          status?: string
          tenant_id: string
          time_off_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at?: string
          id?: string
          note?: string | null
          reason?: string
          staff_id?: string
          starts_at?: string
          status?: string
          tenant_id?: string
          time_off_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "time_off_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_time_off_id_fkey"
            columns: ["time_off_id"]
            isOneToOne: false
            referencedRelation: "time_off"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          booking_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          id: string
          note: string | null
          service_id: string
          staff_id: string | null
          status: string
          tenant_id: string
          time_from: string | null
          time_to: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          id?: string
          note?: string | null
          service_id: string
          staff_id?: string | null
          status?: string
          tenant_id: string
          time_from?: string | null
          time_to?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          id?: string
          note?: string | null
          service_id?: string
          staff_id?: string | null
          status?: string
          tenant_id?: string
          time_from?: string | null
          time_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_booking_id_tenant_id_fkey"
            columns: ["booking_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "waitlist_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "waitlist_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "waitlist_service_id_tenant_id_fkey"
            columns: ["service_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "waitlist_staff_id_tenant_id_fkey"
            columns: ["staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_consent_state: {
        Row: {
          at: string | null
          channel: string | null
          client_id: string | null
          granted: boolean | null
          source: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "client_list"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_client_id_tenant_id_fkey"
            columns: ["client_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "client_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      client_list: {
        Row: {
          anonymized_at: string | null
          average_minor: number | null
          birthday: string | null
          birthday_month: number | null
          blocked_online: boolean | null
          cancellations: number | null
          created_at: string | null
          created_by: string | null
          custom: Json | null
          email: string | null
          first_booking_at: string | null
          first_name: string | null
          gender: string | null
          id: string | null
          important_note: string | null
          last_name: string | null
          last_visit_at: string | null
          next_visit_at: string | null
          no_show_count: number | null
          notes: string | null
          phone_e164: string | null
          preferred_staff_id: string | null
          segment: string | null
          source: string | null
          spent_minor: number | null
          tags: string[] | null
          tenant_id: string | null
          updated_at: string | null
          visits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_preferred_staff_id_tenant_id_fkey"
            columns: ["preferred_staff_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      add_dental_note: {
        Args: { p_body: string; p_booking: string; p_client: string }
        Returns: string
      }
      add_manage_token: {
        Args: { p_booking: string; p_token_hash: string }
        Returns: undefined
      }
      add_review_request: {
        Args: { p_booking: string; p_token_hash: string }
        Returns: boolean
      }
      add_template_services: {
        Args: { p_rows: Json; p_tenant: string }
        Returns: number
      }
      add_to_waitlist: {
        Args: {
          p_client: string
          p_date_from: string
          p_date_to: string
          p_note: string
          p_service: string
          p_staff: string
          p_tenant: string
          p_time_from: string
          p_time_to: string
        }
        Returns: string
      }
      admin_sms_log: {
        Args: { p_limit?: number; p_status?: string }
        Returns: {
          created_at: string
          error_code: string
          id: string
          segments: number
          status: string
          tenant: string
          to_phone: string
          type: string
        }[]
      }
      admin_tenants: {
        Args: never
        Returns: {
          bookings_30d: number
          created_at: string
          deletion_due_at: string
          id: string
          last_activity: string
          name: string
          owner_email: string
          plan: string
          slug: string
          sms_balance: number
          staff_count: number
          status: string
          trial_ends_at: string
          type: string
        }[]
      }
      admin_topup_sms: {
        Args: { p_note: string; p_segments: number; p_tenant: string }
        Returns: undefined
      }
      admin_update_tenant: {
        Args: {
          p_plan: string
          p_status: string
          p_tenant: string
          p_trial_ends_at: string
        }
        Returns: undefined
      }
      anonymize_client: { Args: { p_client: string }; Returns: undefined }
      billing_apply: {
        Args: {
          p_amount: number
          p_card: string
          p_order: string
          p_parent?: string
          p_payment_id: string
          p_status: string
        }
        Returns: string
      }
      billing_autopay_off: { Args: { p_tenant: string }; Returns: undefined }
      billing_start: {
        Args: { p_code: string; p_kind: string; p_tenant: string }
        Returns: {
          amount_minor: number
          id: string
          name: string
          segments: number
        }[]
      }
      can_see_booking: {
        Args: { p_booking: string; p_tenant: string }
        Returns: boolean
      }
      can_see_client: {
        Args: { p_preferred_staff: string; p_tenant: string }
        Returns: boolean
      }
      can_see_money: {
        Args: { p_booking: string; p_tenant: string }
        Returns: boolean
      }
      can_see_revenue: { Args: { p_tenant: string }; Returns: boolean }
      can_use_dental_notes: { Args: { p_tenant: string }; Returns: boolean }
      can_use_payroll: { Args: { p_tenant: string }; Returns: boolean }
      can_write_tenant_folder: { Args: { p_name: string }; Returns: boolean }
      cancel_following: {
        Args: { p_booking: string; p_reason?: string; p_status: string }
        Returns: number
      }
      cancel_tenant_deletion: { Args: { p_tenant: string }; Returns: undefined }
      cancel_time_off_request: { Args: { p_id: string }; Returns: undefined }
      checkout_booking: {
        Args: {
          p_booking: string
          p_charges: Json
          p_discount_minor: number
          p_payments: Json
          p_tip_minor?: number
          p_tip_staff?: string
        }
        Returns: undefined
      }
      create_booking: {
        Args: {
          p_client: string
          p_items: Json
          p_locale?: string
          p_note?: string
          p_source?: string
          p_status?: string
          p_tenant: string
        }
        Returns: string
      }
      create_invitation: {
        Args: { p_email: string; p_role: string; p_tenant: string }
        Returns: string
      }
      create_recurring_booking: {
        Args: {
          p_client: string
          p_every_weeks: number
          p_locale?: string
          p_note?: string
          p_occurrences: Json
          p_source?: string
          p_tenant: string
        }
        Returns: string
      }
      create_tenant: {
        Args: {
          p_locale?: string
          p_name: string
          p_slug: string
          p_type: string
        }
        Returns: string
      }
      current_staff_id: { Args: { p_tenant: string }; Returns: string }
      decide_time_off: {
        Args: { p_approve: boolean; p_id: string; p_note?: string }
        Returns: string
      }
      expire_paid_periods: { Args: never; Returns: number }
      expire_trials: { Args: never; Returns: number }
      export_client: { Args: { p_client: string }; Returns: Json }
      export_tenant: { Args: { p_tenant: string }; Returns: Json }
      get_invitation: {
        Args: { p_token: string }
        Returns: {
          business_name: string
          business_type: string
          email: string
          role: string
          status: string
        }[]
      }
      grant_monthly_sms: { Args: never; Returns: number }
      grant_support_access: {
        Args: { p_hours: number; p_tenant: string }
        Returns: string
      }
      has_role: {
        Args: { p_roles: string[]; p_tenant: string }
        Returns: boolean
      }
      import_bookings: {
        Args: { p_file_name?: string; p_rows: Json; p_tenant: string }
        Returns: Json
      }
      import_clients: {
        Args: { p_rows: Json; p_tenant: string }
        Returns: Json
      }
      import_services: {
        Args: { p_locale: string; p_rows: Json; p_tenant: string }
        Returns: number
      }
      is_platform_admin: { Args: never; Returns: boolean }
      item_snapshot: {
        Args: {
          p_locale: string
          p_service: string
          p_staff: string
          p_tenant: string
          p_variant: string
        }
        Returns: {
          buffer_min: number
          duration_min: number
          name: string
          price_minor: number
          price_type: string
          resource_type: string
        }[]
      }
      link_staff_login: {
        Args: { p_membership: string; p_staff: string }
        Returns: undefined
      }
      log_audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id?: string
          p_meta?: Json
          p_tenant: string
        }
        Returns: undefined
      }
      mark_notifications_read: {
        Args: { p_items?: Json; p_tenant: string }
        Returns: number
      }
      may_book_for: {
        Args: { p_staff: string[]; p_tenant: string }
        Returns: boolean
      }
      merge_clients: {
        Args: { p_keep: string; p_remove: string }
        Returns: undefined
      }
      moderate_review: {
        Args: { p_id: string; p_reply: string; p_status: string }
        Returns: undefined
      }
      move_booking: {
        Args: { p_booking: string; p_items: Json }
        Returns: undefined
      }
      my_notifications: {
        Args: { p_limit?: number; p_tenant: string }
        Returns: {
          at: string
          booking_id: string
          client_name: string
          is_read: boolean
          kind: string
          services: string
          staff: string
          starts_at: string
          status: string
        }[]
      }
      my_notifications_unread: { Args: { p_tenant: string }; Returns: number }
      notification_feed: {
        Args: { p_tenant: string }
        Returns: {
          at: string
          booking_id: string
          is_read: boolean
          kind: string
        }[]
      }
      notification_visible:
        | { Args: { p_booking: string; p_tenant: string }; Returns: boolean }
        | {
            Args: { p_booking: string; p_kind: string; p_tenant: string }
            Returns: boolean
          }
      otp_issue: {
        Args: {
          p_code_hash: string
          p_phone: string
          p_tenant: string
          p_ttl_sec?: number
        }
        Returns: undefined
      }
      otp_verify: {
        Args: {
          p_code_hash: string
          p_pass_hash: string
          p_phone: string
          p_tenant: string
        }
        Returns: string
      }
      public_cancel_booking: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      public_create_booking: {
        Args: {
          p_comment: string
          p_email: string
          p_first_name: string
          p_items: Json
          p_last_name: string
          p_locale: string
          p_manage_token_hash: string
          p_marketing_email: boolean
          p_marketing_sms: boolean
          p_otp_pass_hash: string
          p_phone: string
          p_tenant: string
        }
        Returns: Json
      }
      public_manage_view: { Args: { p_token_hash: string }; Returns: Json }
      public_move_booking: {
        Args: { p_starts_at: string; p_token_hash: string }
        Returns: undefined
      }
      public_review_get: { Args: { p_token_hash: string }; Returns: Json }
      public_review_submit: {
        Args: { p_comment: string; p_rating: number; p_token_hash: string }
        Returns: string
      }
      public_reviews: {
        Args: { p_limit?: number; p_tenant: string }
        Returns: Json
      }
      purge_due_tenants: { Args: never; Returns: number }
      rate_hit: {
        Args: { p_key: string; p_limit: number; p_window_sec: number }
        Returns: boolean
      }
      read_dental_notes: {
        Args: { p_client: string }
        Returns: {
          author_name: string
          body: string
          booking_id: string
          created_at: string
          id: string
        }[]
      }
      request_tenant_deletion: {
        Args: { p_confirm_name: string; p_tenant: string }
        Returns: string
      }
      request_time_off: {
        Args: {
          p_ends: string
          p_note: string
          p_reason: string
          p_staff?: string
          p_starts: string
          p_tenant: string
        }
        Returns: string
      }
      reviews_due: {
        Args: never
        Returns: {
          booking_id: string
          business: string
          client_id: string
          first_name: string
          locale: string
          phone: string
          quiet_end: string
          quiet_start: string
          tenant_id: string
          timezone: string
        }[]
      }
      revoke_invitation: { Args: { p_invitation: string }; Returns: undefined }
      revoke_support_access: { Args: { p_tenant: string }; Returns: undefined }
      set_booking_note: {
        Args: { p_booking: string; p_note: string }
        Returns: undefined
      }
      set_booking_status: {
        Args: { p_booking: string; p_reason?: string; p_status: string }
        Returns: undefined
      }
      set_location_hours: {
        Args: { p_location: string; p_rows: Json }
        Returns: undefined
      }
      set_staff_schedule: {
        Args: { p_rows: Json; p_staff: string }
        Returns: undefined
      }
      set_staff_services: {
        Args: { p_rows: Json; p_staff: string }
        Returns: undefined
      }
      set_waitlist_status: {
        Args: { p_booking?: string; p_entry: string; p_status: string }
        Returns: undefined
      }
      shares_tenant_with: { Args: { p_user: string }; Returns: boolean }
      sms_balance: { Args: { p_tenant: string }; Returns: number }
      sms_claim: {
        Args: { p_limit?: number; p_only?: string }
        Returns: {
          attempts: number
          body: string
          booking_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          delivered_at: string | null
          error_code: string | null
          id: string
          idempotency_key: string
          kind: string
          provider: string | null
          provider_ref: string | null
          segments: number
          send_after: string
          sent_at: string | null
          status: string
          tenant_id: string
          to_phone: string
          type: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sms_messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      sms_delivery: {
        Args: {
          p_delivered: boolean
          p_error?: string
          p_provider: string
          p_ref: string
        }
        Returns: undefined
      }
      sms_due_reminders: {
        Args: never
        Returns: {
          address: string
          booking_id: string
          business: string
          business_phone: string
          client_id: string
          first_name: string
          locale: string
          offset_min: number
          phone: string
          quiet_end: string
          quiet_start: string
          services: string
          staff: string
          starts_at: string
          tenant_id: string
          timezone: string
        }[]
      }
      sms_enqueue: {
        Args: {
          p_body: string
          p_booking?: string
          p_client?: string
          p_created_by?: string
          p_key: string
          p_kind: string
          p_segments: number
          p_send_after?: string
          p_tenant: string
          p_to: string
          p_type: string
        }
        Returns: string
      }
      sms_finish: {
        Args: {
          p_error?: string
          p_id: string
          p_ok: boolean
          p_provider: string
          p_ref: string
          p_retry?: boolean
        }
        Returns: undefined
      }
      sms_topup: {
        Args: { p_note?: string; p_segments: number; p_tenant: string }
        Returns: undefined
      }
      sms_unsubscribe: { Args: { p_client: string }; Returns: undefined }
      staff_has_client: {
        Args: { p_client: string; p_tenant: string }
        Returns: boolean
      }
      start_support_view: { Args: { p_tenant: string }; Returns: string }
      support_view: { Args: { p_tenant: string }; Returns: boolean }
      tenant_has_feature: {
        Args: { p_feature: string; p_tenant: string }
        Returns: boolean
      }
      time_off_conflicts: { Args: { p_id: string }; Returns: number }
      user_tenant_ids: { Args: never; Returns: string[] }
      valid_about: { Args: { p: Json }; Returns: boolean }
      valid_i18n: { Args: { p: Json; p_required?: boolean }; Returns: boolean }
      valid_staff_color: { Args: { p: string }; Returns: boolean }
      write_audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_meta?: Json
          p_tenant: string
        }
        Returns: undefined
      }
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
