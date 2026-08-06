export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      blocked_users: {
        Row: {
          blocked_id: string;
          blocker_id: string;
          created_at: string;
        };
        Insert: {
          blocked_id: string;
          blocker_id: string;
          created_at?: string;
        };
        Update: {
          blocked_id?: string;
          blocker_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          icon: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          icon?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          icon?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          created_at: string;
          id: string;
          job_id: string | null;
          last_message: string | null;
          last_message_at: string;
          user_a: string;
          user_b: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id?: string | null;
          last_message?: string | null;
          last_message_at?: string;
          user_a: string;
          user_b: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string | null;
          last_message?: string | null;
          last_message_at?: string;
          user_a?: string;
          user_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      favorite_workers: {
        Row: {
          created_at: string;
          user_id: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          worker_id?: string;
        };
        Relationships: [];
      };
      job_applications: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          message: string;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          message?: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          message?: string;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          applicants_count: number;
          area: string;
          budget_max: number | null;
          budget_min: number | null;
          budget_note: string | null;
          category_slug: string;
          created_at: string;
          description: string;
          employer_id: string;
          id: string;
          search_vector: unknown;
          status: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at: string;
          urgent: boolean;
        };
        Insert: {
          applicants_count?: number;
          area: string;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_note?: string | null;
          category_slug: string;
          created_at?: string;
          description?: string;
          employer_id: string;
          id?: string;
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at?: string;
          urgent?: boolean;
        };
        Update: {
          applicants_count?: number;
          area?: string;
          budget_max?: number | null;
          budget_min?: number | null;
          budget_note?: string | null;
          category_slug?: string;
          created_at?: string;
          description?: string;
          employer_id?: string;
          id?: string;
          search_vector?: unknown;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string;
          updated_at?: string;
          urgent?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_category_slug_fkey";
            columns: ["category_slug"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["slug"];
          },
        ];
      };
      messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sender_id: string;
        };
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          area: string | null;
          available: boolean;
          avatar_url: string | null;
          bio: string | null;
          category_slug: string | null;
          created_at: string;
          full_name: string;
          headline: string | null;
          id: string;
          is_worker: boolean;
          last_seen_at: string;
          phone: string | null;
          rate_label: string | null;
          rating_avg: number;
          rating_count: number;
          search_vector: unknown;
          skills: string[];
          updated_at: string;
          verification: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          area?: string | null;
          available?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          category_slug?: string | null;
          created_at?: string;
          full_name?: string;
          headline?: string | null;
          id: string;
          is_worker?: boolean;
          last_seen_at?: string;
          phone?: string | null;
          rate_label?: string | null;
          rating_avg?: number;
          rating_count?: number;
          search_vector?: unknown;
          skills?: string[];
          updated_at?: string;
          verification?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          area?: string | null;
          available?: boolean;
          avatar_url?: string | null;
          bio?: string | null;
          category_slug?: string | null;
          created_at?: string;
          full_name?: string;
          headline?: string | null;
          id?: string;
          is_worker?: boolean;
          last_seen_at?: string;
          phone?: string | null;
          rate_label?: string | null;
          rating_avg?: number;
          rating_count?: number;
          search_vector?: unknown;
          skills?: string[];
          updated_at?: string;
          verification?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "profiles_category_slug_fkey";
            columns: ["category_slug"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["slug"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          job_id: string | null;
          reason: string;
          reporter_id: string;
          status: Database["public"]["Enums"]["report_status"];
          subject_user_id: string | null;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          job_id?: string | null;
          reason: string;
          reporter_id: string;
          status?: Database["public"]["Enums"]["report_status"];
          subject_user_id?: string | null;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          job_id?: string | null;
          reason?: string;
          reporter_id?: string;
          status?: Database["public"]["Enums"]["report_status"];
          subject_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          job_id: string | null;
          rating: number;
          reviewer_id: string;
          subject_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          rating: number;
          reviewer_id: string;
          subject_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          rating?: number;
          reviewer_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          job_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          job_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          job_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      verification_requests: {
        Row: {
          created_at: string;
          document_path: string | null;
          id: string;
          id_number_last4: string | null;
          reviewed_at: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          document_path?: string | null;
          id?: string;
          id_number_last4?: string | null;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          document_path?: string | null;
          id?: string;
          id_number_last4?: string | null;
          reviewed_at?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      home_feed: { Args: never; Returns: Json };
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string };
        Returns: boolean;
      };
      profile_search_doc: {
        Args: {
          _area: string;
          _full_name: string;
          _headline: string;
          _skills: string[];
        };
        Returns: unknown;
      };
      push_notification: {
        Args: {
          _body: string;
          _kind: string;
          _link: string;
          _title: string;
          _user_id: string;
        };
        Returns: undefined;
      };
      search_jobs: {
        Args: {
          _area?: string;
          _category?: string;
          _limit?: number;
          _offset?: number;
          _q?: string;
        };
        Returns: {
          applicants_count: number;
          area: string;
          budget_max: number;
          budget_min: number;
          budget_note: string;
          category_slug: string;
          created_at: string;
          description: string;
          employer_name: string;
          id: string;
          title: string;
          urgent: boolean;
        }[];
      };
      search_workers: {
        Args: {
          _category?: string;
          _limit?: number;
          _offset?: number;
          _q?: string;
        };
        Returns: {
          area: string;
          available: boolean;
          avatar_url: string;
          category_slug: string;
          full_name: string;
          headline: string;
          id: string;
          last_seen_at: string;
          rate_label: string;
          rating_avg: number;
          rating_count: number;
          skills: string[];
          verification: Database["public"]["Enums"]["verification_status"];
        }[];
      };
    };
    Enums: {
      app_role: "user" | "moderator" | "admin";
      application_status: "sent" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
      job_status: "open" | "in_progress" | "completed" | "closed";
      report_status: "open" | "reviewing" | "resolved" | "dismissed";
      verification_status: "unverified" | "pending" | "verified" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["user", "moderator", "admin"],
      application_status: ["sent", "shortlisted", "accepted", "rejected", "withdrawn"],
      job_status: ["open", "in_progress", "completed", "closed"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      verification_status: ["unverified", "pending", "verified", "rejected"],
    },
  },
} as const;
