import { describe, expect, it } from 'vitest';
import { resolveSafeNextPath } from './next-path';

describe('resolveSafeNextPath', () => {
  it('returns /app when next path is missing', () => {
    expect(resolveSafeNextPath(null)).toBe('/app');
    expect(resolveSafeNextPath(undefined)).toBe('/app');
  });

  it('accepts in-app relative paths', () => {
    expect(resolveSafeNextPath('/app')).toBe('/app');
    expect(resolveSafeNextPath('/app?foo=bar')).toBe('/app?foo=bar');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(resolveSafeNextPath('https://evil.example/path')).toBe('/app');
    expect(resolveSafeNextPath('//evil.example/path')).toBe('/app');
  });
});
