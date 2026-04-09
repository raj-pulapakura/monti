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
      <button type="button" onClick={() => input.onOAuth('azure')} disabled={input.disabled}>
        Continue with Microsoft
      </button>
      <button type="button" onClick={() => input.onOAuth('apple')} disabled={input.disabled}>
        Continue with Apple
      </button>
    </div>
  );
}
