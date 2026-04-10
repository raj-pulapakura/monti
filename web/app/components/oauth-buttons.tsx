'use client';

import type { Provider } from '@supabase/supabase-js';

export function OAuthButtons(input: {
  onOAuth: (provider: Provider) => void;
  disabled: boolean;
}) {
  return (
    <div className="auth-oauth-list">
      <button type="button" onClick={() => input.onOAuth('google')} disabled={input.disabled}>
        Continue with Google
      </button>
    </div>
  );
}
