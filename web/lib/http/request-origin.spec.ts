import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveRequestOrigin } from './request-origin';

describe('resolveRequestOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the configured site URL when present', () => {
    vi.stubEnv('SITE_URL', 'https://monti.example.com/path');

    expect(
      resolveRequestOrigin({
        url: 'http://internal-host:3000/auth/callback',
        headers: new Headers({
          'x-forwarded-host': 'public.example.com',
          'x-forwarded-proto': 'https',
        }),
      }),
    ).toBe('https://monti.example.com');
  });

  it('prefers forwarded host and proto over the internal request origin', () => {
    expect(
      resolveRequestOrigin({
        url: 'http://b2074e5009da:8080/auth/callback',
        headers: new Headers({
          'x-forwarded-host': 'monti-production-0c16.up.railway.app',
          'x-forwarded-proto': 'https',
        }),
      }),
    ).toBe('https://monti-production-0c16.up.railway.app');
  });

  it('falls back to the request URL origin when forwarded headers are absent', () => {
    expect(
      resolveRequestOrigin({
        url: 'http://localhost:3000/auth/callback',
        headers: new Headers(),
      }),
    ).toBe('http://localhost:3000');
  });
});
