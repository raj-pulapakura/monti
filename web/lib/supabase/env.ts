type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

function readEnvValue(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = readEnvValue('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = readEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (url.length === 0 || anonKey.length === 0) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

export function getRequiredSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  return env;
}
