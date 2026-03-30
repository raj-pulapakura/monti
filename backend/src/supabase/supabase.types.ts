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
          format: 'quiz' | 'game' | 'explainer' | null;
          audience:
            | 'young-kids'
            | 'elementary'
            | 'middle-school'
            | 'high-school'
            | 'university'
            | 'adult'
            | null;
          quality_mode: 'fast' | 'quality';
          provider: 'openai' | 'anthropic' | 'gemini';
          model: string;
          max_tokens: number;
          title: string;
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
          format?: 'quiz' | 'game' | 'explainer' | null;
          audience?:
            | 'young-kids'
            | 'elementary'
            | 'middle-school'
            | 'high-school'
            | 'university'
            | 'adult'
            | null;
          quality_mode: 'fast' | 'quality';
          provider: 'openai' | 'anthropic' | 'gemini';
          model: string;
          max_tokens: number;
          title: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type MontiSupabaseClient = SupabaseClient<Database>;
