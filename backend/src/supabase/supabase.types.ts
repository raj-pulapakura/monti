import type { SupabaseClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      experiences: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          slug: string | null;
          latest_version_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
          is_favourite: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          slug?: string | null;
          latest_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          is_favourite?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          slug?: string | null;
          latest_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
          is_favourite?: boolean;
        };
        Relationships: [];
      };
      experience_versions: {
        Row: {
          id: string;
          generation_id: string;
          experience_id: string;
          parent_generation_id: string | null;
          version_number: number;
          operation: 'generate' | 'refine';
          prompt_summary: string | null;
          quality_mode: 'fast' | 'quality';
          provider: 'openai' | 'anthropic' | 'gemini';
          model: string;
          max_tokens: number;
          description: string;
          html: string;
          css: string;
          js: string;
          generation_status: 'pending' | 'running' | 'succeeded' | 'failed';
          schema_json: Record<string, unknown> | null;
          safety_flags: Record<string, unknown> | null;
          tokens_in: number | null;
          tokens_out: number | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          generation_id: string;
          experience_id: string;
          parent_generation_id?: string | null;
          version_number: number;
          operation: 'generate' | 'refine';
          prompt_summary?: string | null;
          quality_mode: 'fast' | 'quality';
          provider: 'openai' | 'anthropic' | 'gemini';
          model: string;
          max_tokens: number;
          description: string;
          html: string;
          css: string;
          js: string;
          generation_status?: 'pending' | 'running' | 'succeeded' | 'failed';
          schema_json?: Record<string, unknown> | null;
          safety_flags?: Record<string, unknown> | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          generation_status?: 'pending' | 'running' | 'succeeded' | 'failed';
          schema_json?: Record<string, unknown> | null;
          safety_flags?: Record<string, unknown> | null;
          tokens_in?: number | null;
          tokens_out?: number | null;
          latency_ms?: number | null;
        };
        Relationships: [];
      };
      generation_runs: {
        Row: {
          id: string;
          request_id: string;
          experience_id: string | null;
          version_id: string | null;
          user_id: string;
          operation: 'generate' | 'refine';
          provider: string | null;
          model: string | null;
          quality_mode: 'fast' | 'quality' | null;
          input_prompt: string | null;
          output_raw: Record<string, unknown> | null;
          attempt_count: number;
          request_tokens_in: number | null;
          request_tokens_out: number | null;
          status: 'created' | 'running' | 'succeeded' | 'failed';
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          experience_id?: string | null;
          version_id?: string | null;
          user_id: string;
          operation: 'generate' | 'refine';
          provider?: string | null;
          model?: string | null;
          quality_mode?: 'fast' | 'quality' | null;
          input_prompt?: string | null;
          output_raw?: Record<string, unknown> | null;
          attempt_count?: number;
          request_tokens_in?: number | null;
          request_tokens_out?: number | null;
          status?: 'created' | 'running' | 'succeeded' | 'failed';
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          experience_id?: string | null;
          version_id?: string | null;
          provider?: string | null;
          model?: string | null;
          quality_mode?: 'fast' | 'quality' | null;
          output_raw?: Record<string, unknown> | null;
          attempt_count?: number;
          request_tokens_in?: number | null;
          request_tokens_out?: number | null;
          status?: 'created' | 'running' | 'succeeded' | 'failed';
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      billing_checkout_sessions: {
        Row: {
          id: string;
          user_id: string;
          stripe_checkout_session_id: string;
          mode: 'subscription' | 'payment';
          intent: 'subscription' | 'topup';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_checkout_session_id: string;
          mode: 'subscription' | 'payment';
          intent: 'subscription' | 'topup';
          created_at?: string;
        };
        Update: {
          user_id?: string;
          stripe_checkout_session_id?: string;
          mode?: 'subscription' | 'payment';
          intent?: 'subscription' | 'topup';
          created_at?: string;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stripe_customer_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_subscription_id: string;
          status: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          payload: Record<string, unknown> | null;
          processing_status: 'received' | 'processing' | 'processed' | 'failed';
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          payload?: Record<string, unknown> | null;
          processing_status?: 'received' | 'processing' | 'processed' | 'failed';
          error_message?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: {
          payload?: Record<string, unknown> | null;
          processing_status?: 'received' | 'processing' | 'processed' | 'failed';
          error_message?: string | null;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      credit_grants: {
        Row: {
          id: string;
          user_id: string;
          pricing_rule_snapshot_id: string;
          source: 'free_cycle' | 'paid_cycle' | 'topup' | 'manual' | 'promo';
          bucket_kind: 'recurring_free' | 'recurring_paid' | 'topup' | 'manual';
          granted_credits: number;
          remaining_credits: number;
          reserved_credits: number;
          cycle_start: string | null;
          cycle_end: string | null;
          stripe_invoice_id: string | null;
          stripe_checkout_session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pricing_rule_snapshot_id: string;
          source: 'free_cycle' | 'paid_cycle' | 'topup' | 'manual' | 'promo';
          bucket_kind: 'recurring_free' | 'recurring_paid' | 'topup' | 'manual';
          granted_credits: number;
          remaining_credits: number;
          reserved_credits?: number;
          cycle_start?: string | null;
          cycle_end?: string | null;
          stripe_invoice_id?: string | null;
          stripe_checkout_session_id?: string | null;
          created_at?: string;
        };
        Update: {
          remaining_credits?: number;
          reserved_credits?: number;
          cycle_start?: string | null;
          cycle_end?: string | null;
          stripe_invoice_id?: string | null;
          stripe_checkout_session_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      credit_ledger_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_type:
            | 'free_monthly_grant'
            | 'paid_monthly_grant'
            | 'topup_grant'
            | 'manual_grant'
            | 'reservation_created'
            | 'reservation_released'
            | 'debit_settled'
            | 'manual_adjustment'
            | 'expiration';
          credits_delta: number;
          pricing_rule_snapshot_id: string | null;
          credit_grant_id: string | null;
          credit_reservation_id: string | null;
          stripe_event_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_type:
            | 'free_monthly_grant'
            | 'paid_monthly_grant'
            | 'topup_grant'
            | 'manual_grant'
            | 'reservation_created'
            | 'reservation_released'
            | 'debit_settled'
            | 'manual_adjustment'
            | 'expiration';
          credits_delta: number;
          pricing_rule_snapshot_id?: string | null;
          credit_grant_id?: string | null;
          credit_reservation_id?: string | null;
          stripe_event_id?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      credit_reservations: {
        Row: {
          id: string;
          user_id: string;
          status: 'active' | 'released' | 'settled';
          credits_reserved: number;
          credit_grant_id: string | null;
          tool_invocation_id: string | null;
          generation_run_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: 'active' | 'released' | 'settled';
          credits_reserved: number;
          credit_grant_id?: string | null;
          tool_invocation_id?: string | null;
          generation_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'active' | 'released' | 'settled';
          credits_reserved?: number;
          credit_grant_id?: string | null;
          tool_invocation_id?: string | null;
          generation_run_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pricing_rule_snapshots: {
        Row: {
          id: string;
          version_key: string;
          rules_json: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          version_key: string;
          rules_json: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          version_key?: string;
          rules_json?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          title?: string | null;
          archived_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'tool' | 'system';
          content: string;
          content_json: Record<string, unknown> | null;
          idempotency_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          user_id: string;
          role: 'user' | 'assistant' | 'tool' | 'system';
          content: string;
          content_json?: Record<string, unknown> | null;
          idempotency_key?: string | null;
          created_at?: string;
        };
        Update: {
          content_json?: Record<string, unknown> | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          user_id: string;
          kind: 'general' | 'thumbs_up' | 'thumbs_down';
          message: string | null;
          thread_id: string | null;
          message_id: string | null;
          experience_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: 'general' | 'thumbs_up' | 'thumbs_down';
          message?: string | null;
          thread_id?: string | null;
          message_id?: string | null;
          experience_id?: string | null;
          created_at?: string;
        };
        Update: {
          message?: string | null;
        };
        Relationships: [];
      };
      assistant_runs: {
        Row: {
          id: string;
          thread_id: string;
          user_message_id: string;
          assistant_message_id: string | null;
          status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
          router_tier: 'fast' | 'quality' | null;
          router_provider_hint: 'openai' | 'anthropic' | 'gemini' | null;
          router_confidence: number | null;
          router_reason: string | null;
          router_fallback_reason: string | null;
          conversation_provider: 'openai' | 'anthropic' | 'gemini' | null;
          conversation_model: string | null;
          provider: 'openai' | 'anthropic' | 'gemini' | null;
          model: string | null;
          provider_request_raw: Record<string, unknown> | null;
          provider_response_raw: Record<string, unknown> | null;
          conversation_tokens_in: number | null;
          conversation_tokens_out: number | null;
          error_code: string | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          user_message_id: string;
          assistant_message_id?: string | null;
          status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
          router_tier?: 'fast' | 'quality' | null;
          router_provider_hint?: 'openai' | 'anthropic' | 'gemini' | null;
          router_confidence?: number | null;
          router_reason?: string | null;
          router_fallback_reason?: string | null;
          conversation_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          conversation_model?: string | null;
          provider?: 'openai' | 'anthropic' | 'gemini' | null;
          model?: string | null;
          provider_request_raw?: Record<string, unknown> | null;
          provider_response_raw?: Record<string, unknown> | null;
          conversation_tokens_in?: number | null;
          conversation_tokens_out?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          assistant_message_id?: string | null;
          status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
          router_tier?: 'fast' | 'quality' | null;
          router_provider_hint?: 'openai' | 'anthropic' | 'gemini' | null;
          router_confidence?: number | null;
          router_reason?: string | null;
          router_fallback_reason?: string | null;
          conversation_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          conversation_model?: string | null;
          provider?: 'openai' | 'anthropic' | 'gemini' | null;
          model?: string | null;
          provider_request_raw?: Record<string, unknown> | null;
          provider_response_raw?: Record<string, unknown> | null;
          conversation_tokens_in?: number | null;
          conversation_tokens_out?: number | null;
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      tool_invocations: {
        Row: {
          id: string;
          thread_id: string;
          run_id: string;
          provider_tool_call_id: string | null;
          tool_name: string;
          tool_arguments: Record<string, unknown>;
          tool_result: Record<string, unknown> | null;
          generation_id: string | null;
          experience_id: string | null;
          experience_version_id: string | null;
          router_tier: 'fast' | 'quality' | null;
          router_confidence: number | null;
          router_reason: string | null;
          router_fallback_reason: string | null;
          router_provider: 'openai' | 'anthropic' | 'gemini' | null;
          router_model: string | null;
          router_request_raw: Record<string, unknown> | null;
          router_response_raw: Record<string, unknown> | null;
          router_tokens_in: number | null;
          router_tokens_out: number | null;
          selected_provider: 'openai' | 'anthropic' | 'gemini' | null;
          selected_model: string | null;
          status: 'pending' | 'running' | 'succeeded' | 'failed';
          error_code: string | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          run_id: string;
          provider_tool_call_id?: string | null;
          tool_name: string;
          tool_arguments?: Record<string, unknown>;
          tool_result?: Record<string, unknown> | null;
          generation_id?: string | null;
          experience_id?: string | null;
          experience_version_id?: string | null;
          router_tier?: 'fast' | 'quality' | null;
          router_confidence?: number | null;
          router_reason?: string | null;
          router_fallback_reason?: string | null;
          router_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          router_model?: string | null;
          router_request_raw?: Record<string, unknown> | null;
          router_response_raw?: Record<string, unknown> | null;
          router_tokens_in?: number | null;
          router_tokens_out?: number | null;
          selected_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          selected_model?: string | null;
          status?: 'pending' | 'running' | 'succeeded' | 'failed';
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          provider_tool_call_id?: string | null;
          tool_result?: Record<string, unknown> | null;
          generation_id?: string | null;
          experience_id?: string | null;
          experience_version_id?: string | null;
          router_tier?: 'fast' | 'quality' | null;
          router_confidence?: number | null;
          router_reason?: string | null;
          router_fallback_reason?: string | null;
          router_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          router_model?: string | null;
          router_request_raw?: Record<string, unknown> | null;
          router_response_raw?: Record<string, unknown> | null;
          router_tokens_in?: number | null;
          router_tokens_out?: number | null;
          selected_provider?: 'openai' | 'anthropic' | 'gemini' | null;
          selected_model?: string | null;
          status?: 'pending' | 'running' | 'succeeded' | 'failed';
          error_code?: string | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      sandbox_states: {
        Row: {
          thread_id: string;
          status: 'empty' | 'creating' | 'ready' | 'error';
          experience_id: string | null;
          experience_version_id: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          updated_at: string;
        };
        Insert: {
          thread_id: string;
          status?: 'empty' | 'creating' | 'ready' | 'error';
          experience_id?: string | null;
          experience_version_id?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          updated_at?: string;
        };
        Update: {
          status?: 'empty' | 'creating' | 'ready' | 'error';
          experience_id?: string | null;
          experience_version_id?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      chat_submit_user_message: {
        Args: {
          p_thread_id: string;
          p_content: string;
          p_idempotency_key?: string | null;
        };
        Returns: {
          message_id: string;
          message_created_at: string;
          run_id: string | null;
          run_status: string | null;
          deduplicated: boolean;
        }[];
      };
      billing_ensure_free_monthly_grant_with_ledger: {
        Args: {
          p_user_id: string;
          p_pricing_rule_snapshot_id: string;
          p_amount: number;
          p_cycle_start: string;
          p_cycle_end: string;
        };
        Returns: string;
      };
      billing_reserve_generation_credits: {
        Args: {
          p_user_id: string;
          p_tool_invocation_id: string;
          p_credits: number;
          p_pricing_rule_snapshot_id: string;
          p_now?: string;
        };
        Returns: Record<string, unknown>;
      };
      billing_release_generation_reservation: {
        Args: {
          p_user_id: string;
          p_tool_invocation_id: string;
          p_pricing_rule_snapshot_id: string;
        };
        Returns: undefined;
      };
      billing_settle_generation_reservation: {
        Args: {
          p_user_id: string;
          p_tool_invocation_id: string;
          p_pricing_rule_snapshot_id: string;
          p_experience_version_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type MontiSupabaseClient = SupabaseClient<Database>;
