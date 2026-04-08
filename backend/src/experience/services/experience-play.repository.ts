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

  async findBySlug(
    slug: string,
    versionNumber?: number,
  ): Promise<PublicExperience | null> {
    const trimmed = slug.trim();
    if (!trimmed) {
      throw new ValidationError('Slug must not be empty.');
    }

    const { data: experience, error: expError } = await this.client
      .from('experiences')
      .select('id,latest_version_id,title')
      .eq('slug', trimmed)
      .is('archived_at', null)
      .maybeSingle();

    if (expError) {
      this.throwQueryError('find experience by slug', expError);
    }

    if (!experience) {
      return null;
    }

    let versionQuery = this.client
      .from('experience_versions')
      .select('html,css,js')
      .eq('generation_status', 'succeeded');

    if (versionNumber !== undefined) {
      versionQuery = versionQuery
        .eq('experience_id', experience.id)
        .eq('version_number', versionNumber);
    } else {
      if (!experience.latest_version_id) {
        return null;
      }
      versionQuery = versionQuery.eq('id', experience.latest_version_id);
    }

    const { data: version, error: versionError } = await versionQuery.maybeSingle();

    if (versionError) {
      this.throwQueryError('load experience version for play', versionError);
    }

    if (!version) {
      return null;
    }

    return {
      title: experience.title,
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
