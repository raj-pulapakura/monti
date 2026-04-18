import { describe, expect, it } from 'vitest';
import { mergeSandboxStateByRecency } from './runtime-state';

const base = (overrides: Partial<Parameters<typeof mergeSandboxStateByRecency>[1]>) => ({
  threadId: 't1',
  status: 'creating' as const,
  experienceId: null,
  experienceVersionId: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  updatedAt: '2026-04-18T12:00:00.000Z',
  ...overrides,
});

describe('mergeSandboxStateByRecency', () => {
  it('uses incoming when previous is null', () => {
    const incoming = base({ status: 'ready' });
    expect(mergeSandboxStateByRecency(null, incoming)).toEqual(incoming);
  });

  it('prefers newer updatedAt', () => {
    const prev = base({ status: 'creating', updatedAt: '2026-04-18T12:00:01.000Z' });
    const incoming = base({ status: 'ready', updatedAt: '2026-04-18T12:00:02.000Z' });
    expect(mergeSandboxStateByRecency(prev, incoming)).toEqual(incoming);
  });

  it('keeps previous when incoming is older', () => {
    const prev = base({ status: 'ready', updatedAt: '2026-04-18T12:00:02.000Z' });
    const incoming = base({ status: 'creating', updatedAt: '2026-04-18T12:00:01.000Z' });
    expect(mergeSandboxStateByRecency(prev, incoming)).toEqual(prev);
  });

  it('on same timestamp prefers ready over creating', () => {
    const ts = '2026-04-18T12:00:00.000Z';
    const prev = base({ status: 'creating', updatedAt: ts });
    const incoming = base({ status: 'ready', updatedAt: ts, experienceId: 'e1' });
    expect(mergeSandboxStateByRecency(prev, incoming)).toEqual(incoming);
  });
});
