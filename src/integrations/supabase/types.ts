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
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          icon: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          icon?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          icon?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      certificates: {
        Row: {
          created_at: string
          id: string
          issuer: string | null
          title: string
          user_id: string
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          issuer?: string | null
          title: string
          user_id: string
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          issuer?: string | null
          title?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          last_message: string | null
          last_message_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          last_message?: string | null
          last_message_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          last_message?: string | null
          last_message_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_workers: {
        Row: {
          created_at: string
          user_id: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          worker_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          worker_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          created_at: string
          id: string
          job_id: string
          message: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          worker_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_escrows: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          employer_id: string
          funded_at: string | null
          id: string
          job_id: string
          released_at: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          employer_id: string
          funded_at?: string | null
          id?: string
          job_id: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          employer_id?: string
          funded_at?: string | null
          id?: string
          job_id?: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_escrows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applicants_count: number
          area: string
          budget_max: number | null
          budget_min: number | null
          budget_note: string | null
          category_slug: string
          created_at: string
          description: string
          employer_id: string
          hidden_at: string | null
          hidden_reason: string | null
          id: string
          search_vector: unknown
          skills: string[]
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          urgent: boolean
        }
        Insert: {
          applicants_count?: number
          area: string
          budget_max?: number | null
          budget_min?: number | null
          budget_note?: string | null
          category_slug: string
          created_at?: string
          description?: string
          employer_id: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          search_vector?: unknown
          skills?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          applicants_count?: number
          area?: string
          budget_max?: number | null
          budget_min?: number | null
          budget_note?: string | null
          category_slug?: string
          created_at?: string
          description?: string
          employer_id?: string
          hidden_at?: string | null
          hidden_reason?: string | null
          id?: string
          search_vector?: unknown
          skills?: string[]
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "jobs_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          attempts: number
          created_at: string
          currency: string
          entity_id: string | null
          entity_type: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          provider: string
          provider_reference: string | null
          purpose: string
          reference: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          attempts?: number
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          provider?: string
          provider_reference?: string | null
          purpose: string
          reference: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          attempts?: number
          created_at?: string
          currency?: string
          entity_id?: string | null
          entity_type?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          provider?: string
          provider_reference?: string | null
          purpose?: string
          reference?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          signature_valid: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          signature_valid?: boolean
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_path?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          area: string | null
          available: boolean
          avatar_url: string | null
          bio: string | null
          category_slug: string | null
          cover_url: string | null
          created_at: string
          full_name: string
          headline: string | null
          id: string
          is_worker: boolean
          languages: string[]
          last_seen_at: string
          phone: string | null
          rate_label: string | null
          rating_avg: number
          rating_count: number
          search_vector: unknown
          skills: string[]
          suspended_at: string | null
          suspension_reason: string | null
          trades: string[]
          updated_at: string
          verification: Database["public"]["Enums"]["verification_status"]
          years_experience: number | null
        }
        Insert: {
          area?: string | null
          available?: boolean
          avatar_url?: string | null
          bio?: string | null
          category_slug?: string | null
          cover_url?: string | null
          created_at?: string
          full_name?: string
          headline?: string | null
          id: string
          is_worker?: boolean
          languages?: string[]
          last_seen_at?: string
          phone?: string | null
          rate_label?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          skills?: string[]
          suspended_at?: string | null
          suspension_reason?: string | null
          trades?: string[]
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
          years_experience?: number | null
        }
        Update: {
          area?: string | null
          available?: boolean
          avatar_url?: string | null
          bio?: string | null
          category_slug?: string | null
          cover_url?: string | null
          created_at?: string
          full_name?: string
          headline?: string | null
          id?: string
          is_worker?: boolean
          languages?: string[]
          last_seen_at?: string
          phone?: string | null
          rate_label?: string | null
          rating_avg?: number
          rating_count?: number
          search_vector?: unknown
          skills?: string[]
          suspended_at?: string | null
          suspension_reason?: string | null
          trades?: string[]
          updated_at?: string
          verification?: Database["public"]["Enums"]["verification_status"]
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["slug"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          job_id: string | null
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          subject_user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          job_id?: string | null
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          subject_user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          job_id?: string | null
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          job_id: string | null
          rating: number
          reviewer_id: string
          subject_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          rating: number
          reviewer_id: string
          subject_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          rating?: number
          reviewer_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      verification_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          notes: string | null
          request_id: string | null
          status: Database["public"]["Enums"]["verification_status"] | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          request_id?: string | null
          status?: Database["public"]["Enums"]["verification_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "verification_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          attempt: number
          back_path: string | null
          created_at: string
          doc_type: Database["public"]["Enums"]["id_document_type"]
          document_path: string | null
          front_path: string | null
          id: string
          id_number_last4: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_path: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          back_path?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["id_document_type"]
          document_path?: string | null
          front_path?: string | null
          id?: string
          id_number_last4?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          back_path?: string | null
          created_at?: string
          doc_type?: Database["public"]["Enums"]["id_document_type"]
          document_path?: string | null
          front_path?: string | null
          id?: string
          id_number_last4?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_path?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount_cents: number
          counterparty_id: string | null
          created_at: string
          currency: string
          description: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_type: string
          id: string
          job_id: string | null
          metadata: Json
          status: Database["public"]["Enums"]["ledger_status"]
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description: string
          direction: Database["public"]["Enums"]["ledger_direction"]
          entry_type: string
          id?: string
          job_id?: string | null
          metadata?: Json
          status?: Database["public"]["Enums"]["ledger_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          counterparty_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          direction?: Database["public"]["Enums"]["ledger_direction"]
          entry_type?: string
          id?: string
          job_id?: string | null
          metadata?: Json
          status?: Database["public"]["Enums"]["ledger_status"]
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_category: { Args: { _slug: string }; Returns: Json }
      admin_delete_review: {
        Args: { _id: string; _reason?: string }
        Returns: Json
      }
      admin_review_verification: {
        Args: {
          _id: string
          _notes?: string
          _status: Database["public"]["Enums"]["verification_status"]
        }
        Returns: Json
      }
      admin_send_notification: {
        Args: {
          _body: string
          _link?: string
          _title: string
          _user_id: string
        }
        Returns: Json
      }
      admin_set_job_hidden: {
        Args: { _hidden: boolean; _job_id: string; _reason?: string }
        Returns: Json
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: Json
      }
      admin_set_role_permission: {
        Args: {
          _enabled: boolean
          _permission: Database["public"]["Enums"]["app_permission"]
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      admin_set_setting: { Args: { _key: string; _value: Json }; Returns: Json }
      admin_set_suspension: {
        Args: { _reason?: string; _suspended: boolean; _user_id: string }
        Returns: Json
      }
      admin_stats: { Args: never; Returns: Json }
      admin_update_report: {
        Args: {
          _id: string
          _notes?: string
          _status: Database["public"]["Enums"]["report_status"]
        }
        Returns: Json
      }
      admin_upsert_category: {
        Args: {
          _icon: string
          _name: string
          _slug: string
          _sort_order: number
        }
        Returns: Json
      }
      claim_super_admin: { Args: never; Returns: Json }
      escrow_fund_job: {
        Args: { _amount_cents: number; _job_id: string }
        Returns: Json
      }
      escrow_refund: {
        Args: { _job_id: string; _reason?: string }
        Returns: Json
      }
      escrow_release: { Args: { _job_id: string }; Returns: Json }
      escrow_set_status: {
        Args: {
          _job_id: string
          _status: Database["public"]["Enums"]["escrow_status"]
        }
        Returns: Json
      }
      has_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["app_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      home_feed: { Args: never; Returns: Json }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_permissions: {
        Args: never
        Returns: {
          permission: Database["public"]["Enums"]["app_permission"]
        }[]
      }
      payment_apply_result: {
        Args: {
          _failure_reason?: string
          _provider_reference?: string
          _reference: string
          _status: string
        }
        Returns: Json
      }
      post_ledger: {
        Args: {
          _amount_cents: number
          _counterparty?: string
          _description: string
          _direction: Database["public"]["Enums"]["ledger_direction"]
          _job_id?: string
          _status: Database["public"]["Enums"]["ledger_status"]
          _transaction_id?: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      profile_search_doc: {
        Args: {
          _area: string
          _full_name: string
          _headline: string
          _skills: string[]
        }
        Returns: unknown
      }
      public_profile: { Args: { _id: string }; Returns: Json }
      push_notification: {
        Args: {
          _body: string
          _kind: string
          _link: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      require_permission: {
        Args: { _permission: Database["public"]["Enums"]["app_permission"] }
        Returns: undefined
      }
      search_jobs: {
        Args: {
          _area?: string
          _category?: string
          _limit?: number
          _offset?: number
          _q?: string
        }
        Returns: {
          applicants_count: number
          area: string
          budget_max: number
          budget_min: number
          budget_note: string
          category_slug: string
          created_at: string
          description: string
          employer_avatar: string
          employer_id: string
          employer_name: string
          employer_verification: Database["public"]["Enums"]["verification_status"]
          id: string
          payment_secured: boolean
          skills: string[]
          title: string
          urgent: boolean
        }[]
      }
      search_workers: {
        Args: {
          _category?: string
          _limit?: number
          _offset?: number
          _q?: string
        }
        Returns: {
          area: string
          available: boolean
          avatar_url: string
          category_slug: string
          completed_jobs: number
          full_name: string
          headline: string
          id: string
          last_seen_at: string
          rate_label: string
          rating_avg: number
          rating_count: number
          skills: string[]
          verification: Database["public"]["Enums"]["verification_status"]
        }[]
      }
      submit_verification: {
        Args: {
          _back_path: string
          _doc_type: Database["public"]["Enums"]["id_document_type"]
          _front_path: string
          _last4: string
          _selfie_path: string
        }
        Returns: Json
      }
      super_admin_exists: { Args: never; Returns: boolean }
      wallet_available_cents: { Args: { _user_id: string }; Returns: number }
      wallet_cancel_topup: { Args: { _reference: string }; Returns: Json }
      wallet_request_withdrawal: {
        Args: { _amount_cents: number; _phone: string }
        Returns: Json
      }
      wallet_start_topup: {
        Args: { _amount_cents: number; _phone: string; _provider?: string }
        Returns: Json
      }
      wallet_summary: { Args: { _user_id?: string }; Returns: Json }
      write_audit: {
        Args: {
          _action: string
          _details: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_permission:
        | "users.read"
        | "users.write"
        | "roles.read"
        | "roles.write"
        | "verification.read"
        | "verification.write"
        | "jobs.read"
        | "jobs.write"
        | "applications.read"
        | "applications.write"
        | "workers.read"
        | "workers.write"
        | "employers.read"
        | "employers.write"
        | "messages.read"
        | "messages.moderate"
        | "reports.read"
        | "reports.write"
        | "reviews.read"
        | "reviews.write"
        | "notifications.read"
        | "notifications.write"
        | "categories.read"
        | "categories.write"
        | "settings.read"
        | "settings.write"
        | "payments.read"
        | "payments.write"
        | "analytics.read"
        | "audit.read"
      app_role:
        | "user"
        | "moderator"
        | "admin"
        | "super_admin"
        | "support_agent"
        | "verification_officer"
        | "content_moderator"
        | "analyst"
      application_status:
        | "sent"
        | "shortlisted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      escrow_status:
        | "awaiting_funding"
        | "secured"
        | "in_progress"
        | "awaiting_confirmation"
        | "released"
        | "refunded"
        | "cancelled"
      id_document_type: "national_id" | "passport" | "driving_licence"
      job_status: "open" | "in_progress" | "completed" | "closed"
      ledger_direction: "credit" | "debit"
      ledger_status: "pending" | "settled" | "held" | "failed" | "cancelled"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      verification_status: "unverified" | "pending" | "verified" | "rejected"
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
      app_permission: [
        "users.read",
        "users.write",
        "roles.read",
        "roles.write",
        "verification.read",
        "verification.write",
        "jobs.read",
        "jobs.write",
        "applications.read",
        "applications.write",
        "workers.read",
        "workers.write",
        "employers.read",
        "employers.write",
        "messages.read",
        "messages.moderate",
        "reports.read",
        "reports.write",
        "reviews.read",
        "reviews.write",
        "notifications.read",
        "notifications.write",
        "categories.read",
        "categories.write",
        "settings.read",
        "settings.write",
        "payments.read",
        "payments.write",
        "analytics.read",
        "audit.read",
      ],
      app_role: [
        "user",
        "moderator",
        "admin",
        "super_admin",
        "support_agent",
        "verification_officer",
        "content_moderator",
        "analyst",
      ],
      application_status: [
        "sent",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      escrow_status: [
        "awaiting_funding",
        "secured",
        "in_progress",
        "awaiting_confirmation",
        "released",
        "refunded",
        "cancelled",
      ],
      id_document_type: ["national_id", "passport", "driving_licence"],
      job_status: ["open", "in_progress", "completed", "closed"],
      ledger_direction: ["credit", "debit"],
      ledger_status: ["pending", "settled", "held", "failed", "cancelled"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const
