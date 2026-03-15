import { Injectable } from '@nestjs/common';

@Injectable()
export class SupabaseConfigService {
  private readonly projectUrl: string;
  private readonly serviceRoleKey: string;

  constructor() {
    const url = process.env.SUPABASE_URL?.trim() ?? '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

    if (url.length === 0) {
      throw new Error('SUPABASE_URL is required.');
    }

    try {
      // Validate URL shape eagerly at startup.
      new URL(url);
    } catch {
      throw new Error('SUPABASE_URL must be a valid URL.');
    }

    if (key.length === 0) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
    }

    this.projectUrl = url;
    this.serviceRoleKey = key;
  }

  get url(): string {
    return this.projectUrl;
  }

  get key(): string {
    return this.serviceRoleKey;
  }
}
