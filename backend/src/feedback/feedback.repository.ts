import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../supabase/supabase.types';

type FeedbackInsert = Database['public']['Tables']['feedback']['Insert'];

@Injectable()
export class FeedbackRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly admin: MontiSupabaseClient,
  ) {}

  async insert(row: FeedbackInsert): Promise<void> {
    const { error } = await this.admin.from('feedback').insert(row);
    if (error) {
      throw new AppError('INTERNAL_ERROR', error.message, 500, error);
    }
  }
}
