import type { SupabaseClient } from '@supabase/supabase-js';

export interface Database {
  public: {
    Tables: {
      experiences: {
        Row: {
          id: string;
          user_id: string | null;
          client_id: string;
          title: string;
          slug: string | null;
          latest_version_id: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_id: string;
          title: string;
          slug?: string | null;
          latest_version_id?: string | null;
          created_at?: string;
          updated_at?: string;
          archived_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_id?: string;
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
          audience: 'young-kids' | 'elementary' | 'middle-school' | null;
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
          audience?: 'young-kids' | 'elementary' | 'middle-school' | null;
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
          client_id: string;
          operation: 'generate' | 'refine';
          provider: string | null;
          model: string | null;
          quality_mode: 'fast' | 'quality' | null;
          input_prompt: string | null;
          output_raw: Record<string, unknown> | null;
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
          client_id: string;
          operation: 'generate' | 'refine';
          provider?: string | null;
          model?: string | null;
          quality_mode?: 'fast' | 'quality' | null;
          input_prompt?: string | null;
          output_raw?: Record<string, unknown> | null;
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
          status?: 'created' | 'running' | 'succeeded' | 'failed';
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type MontiSupabaseClient = SupabaseClient<Database>;
