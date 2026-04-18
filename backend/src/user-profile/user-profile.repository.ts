import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../supabase/supabase.types';

export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

@Injectable()
export class UserProfileRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly admin: MontiSupabaseClient,
  ) {}

  async findByUserId(userId: string): Promise<UserProfileRow | null> {
    const { data, error } = await this.admin
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new AppError('INTERNAL_ERROR', error.message, 500, error);
    }

    return data;
  }

  async insert(row: UserProfileInsert): Promise<UserProfileRow> {
    const { data, error } = await this.admin.from('user_profiles').insert(row).select().single();

    if (error || !data) {
      throw new AppError('INTERNAL_ERROR', error?.message ?? 'Insert failed.', 500, error);
    }

    return data;
  }

  async update(userId: string, patch: UserProfileUpdate): Promise<UserProfileRow> {
    const { data, error } = await this.admin
      .from('user_profiles')
      .update(patch)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      throw new AppError('INTERNAL_ERROR', error?.message ?? 'Update failed.', 500, error);
    }

    return data;
  }
}
