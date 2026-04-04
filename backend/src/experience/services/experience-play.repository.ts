import { Inject, Injectable } from '@nestjs/common';
import { AppError, ValidationError } from '../../common/errors/app-error';
import { SUPABASE_ADMIN_CLIENT } from '../../supabase/supabase.constants';
import type { MontiSupabaseClient } from '../../supabase/supabase.types';

export interface PublicExperience {
  title: string;
  html: string;
  css: string;
  js: string;
}

@Injectable()
export class ExperiencePlayRepository {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly client: MontiSupabaseClient,
  ) {}

  async findBySlug(slug: string): Promise<PublicExperience | null> {
    const trimmed = slug.trim();
    if (!trimmed) {
      throw new ValidationError('Slug must not be empty.');
    }

    const { data: experience, error: expError } = await this.client
      .from('experiences')
      .select('latest_version_id')
      .eq('slug', trimmed)
      .is('archived_at', null)
      .maybeSingle();

    if (expError) {
      this.throwQueryError('find experience by slug', expError);
    }

    if (!experience || !experience.latest_version_id) {
      return null;
    }

    const { data: version, error: versionError } = await this.client
      .from('experience_versions')
      .select('title,html,css,js')
      .eq('id', experience.latest_version_id)
      .maybeSingle();

    if (versionError) {
      this.throwQueryError('load experience version for play', versionError);
    }

    if (!version) {
      return null;
    }

    return {
      title: version.title,
      html: version.html,
      css: version.css,
      js: version.js,
    };
  }

  private throwQueryError(
    action: string,
    error: { message: string; code?: string | null },
  ): never {
    throw new AppError('INTERNAL_ERROR', `Failed to ${action}.`, 500, {
      code: error.code ?? undefined,
      message: error.message,
    });
  }
}
