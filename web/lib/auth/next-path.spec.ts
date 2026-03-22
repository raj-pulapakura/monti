import { describe, expect, it } from 'vitest';
import { resolveSafeNextPath } from './next-path';

describe('resolveSafeNextPath', () => {
  it('returns / when next path is missing', () => {
    expect(resolveSafeNextPath(null)).toBe('/');
    expect(resolveSafeNextPath(undefined)).toBe('/');
  });

  it('accepts in-app relative paths', () => {
    expect(resolveSafeNextPath('/chat/123')).toBe('/chat/123');
    expect(resolveSafeNextPath('/chat/123?foo=bar')).toBe('/chat/123?foo=bar');
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(resolveSafeNextPath('https://evil.example/path')).toBe('/');
    expect(resolveSafeNextPath('//evil.example/path')).toBe('/');
  });
});
