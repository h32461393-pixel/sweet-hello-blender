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
      ad_views: {
        Row: {
          created_at: string
          day: string
          id: string
          reward: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string
          id?: string
          reward: number
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          id?: string
          reward?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit: {
        Row: {
          action: string
          admin_telegram_id: number
          created_at: string
          details: Json | null
          id: string
          target: string | null
        }
        Insert: {
          action: string
          admin_telegram_id: number
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          admin_telegram_id?: number
          created_at?: string
          details?: Json | null
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      app_users: {
        Row: {
          balance: number
          created_at: string
          device_hash: string | null
          first_name: string | null
          id: string
          language_code: string | null
          last_daily_date: string | null
          last_name: string | null
          last_seen_at: string
          mining_claimed: boolean
          mining_started_at: string | null
          photo_url: string | null
          referred_by: string | null
          signup_ip: string | null
          streak_day: number
          suspend_reason: string | null
          suspended: boolean
          telegram_id: number
          total_earned: number
          username: string | null
          wallet_address: string | null
          withdrawal_count: number
        }
        Insert: {
          balance?: number
          created_at?: string
          device_hash?: string | null
          first_name?: string | null
          id?: string
          language_code?: string | null
          last_daily_date?: string | null
          last_name?: string | null
          last_seen_at?: string
          mining_claimed?: boolean
          mining_started_at?: string | null
          photo_url?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          streak_day?: number
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id: number
          total_earned?: number
          username?: string | null
          wallet_address?: string | null
          withdrawal_count?: number
        }
        Update: {
          balance?: number
          created_at?: string
          device_hash?: string | null
          first_name?: string | null
          id?: string
          language_code?: string | null
          last_daily_date?: string | null
          last_name?: string | null
          last_seen_at?: string
          mining_claimed?: boolean
          mining_started_at?: string | null
          photo_url?: string | null
          referred_by?: string | null
          signup_ip?: string | null
          streak_day?: number
          suspend_reason?: string | null
          suspended?: boolean
          telegram_id?: number
          total_earned?: number
          username?: string | null
          wallet_address?: string | null
          withdrawal_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          subject: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          subject: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          subject?: string
          window_start?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          fake: boolean
          id: string
          pending_reward: number
          referee_id: string
          referrer_id: string
          stage_day1: boolean
          stage_day2: boolean
          stage_join: boolean
          status: string
        }
        Insert: {
          created_at?: string
          fake?: boolean
          id?: string
          pending_reward?: number
          referee_id: string
          referrer_id: string
          stage_day1?: boolean
          stage_day2?: boolean
          stage_join?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          fake?: boolean
          id?: string
          pending_reward?: number
          referee_id?: string
          referrer_id?: string
          stage_day1?: boolean
          stage_day2?: boolean
          stage_join?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referee_id_fkey"
            columns: ["referee_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_code_claims: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_code_claims_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "reward_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "reward_code_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_codes: {
        Row: {
          active: boolean
          amount: number
          code: string
          created_at: string
          expires_at: string | null
          max_uses: number
          uses: number
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          created_at?: string
          expires_at?: string | null
          max_uses?: number
          uses?: number
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          created_at?: string
          expires_at?: string | null
          max_uses?: number
          uses?: number
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          created_at: string
          day: string
          task_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          task_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          task_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          active: boolean
          chat_username: string | null
          created_at: string
          id: string
          reward: number
          section: string
          sort_order: number
          title: string
          url: string
          verify_type: string
        }
        Insert: {
          active?: boolean
          chat_username?: string | null
          created_at?: string
          id?: string
          reward?: number
          section?: string
          sort_order?: number
          title: string
          url: string
          verify_type?: string
        }
        Update: {
          active?: boolean
          chat_username?: string | null
          created_at?: string
          id?: string
          reward?: number
          section?: string
          sort_order?: number
          title?: string
          url?: string
          verify_type?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          idempotency_key: string | null
          kind: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          kind?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          address: string
          amount_tokens: number
          created_at: string
          fee_usd: number
          gross_usd: number
          id: string
          net_usd: number
          processed_at: string | null
          seq: number
          status: string
          txid: string | null
          user_id: string
        }
        Insert: {
          address: string
          amount_tokens: number
          created_at?: string
          fee_usd: number
          gross_usd: number
          id?: string
          net_usd: number
          processed_at?: string | null
          seq?: number
          status?: string
          txid?: string | null
          user_id: string
        }
        Update: {
          address?: string
          amount_tokens?: number
          created_at?: string
          fee_usd?: number
          gross_usd?: number
          id?: string
          net_usd?: number
          processed_at?: string | null
          seq?: number
          status?: string
          txid?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ad_view_v1: {
        Args: {
          _cooldown_seconds: number
          _daily_cap: number
          _reward: number
          _source: string
          _user_id: string
        }
        Returns: Json
      }
      claim_daily_v1: {
        Args: { _rewards: number[]; _user_id: string }
        Returns: Json
      }
      claim_mining_v1: {
        Args: { _duration_minutes: number; _reward: number; _user_id: string }
        Returns: Json
      }
      claim_reward_code_v1: {
        Args: { _code: string; _user_id: string }
        Returns: Json
      }
      credit_user: {
        Args: {
          _amount: number
          _key: string
          _kind: string
          _note: string
          _user_id: string
        }
        Returns: number
      }
      debit_user: {
        Args: {
          _amount: number
          _key: string
          _kind: string
          _note: string
          _user_id: string
        }
        Returns: number
      }
      rl_hit: {
        Args: {
          _bucket: string
          _limit: number
          _subject: string
          _window_seconds: number
        }
        Returns: boolean
      }
      start_mining_v1: { Args: { _user_id: string }; Returns: boolean }
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
