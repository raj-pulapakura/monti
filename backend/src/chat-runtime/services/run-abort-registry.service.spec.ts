import { RunAbortRegistryService } from './run-abort-registry.service';

describe('RunAbortRegistryService', () => {
  it('register returns a signal, abort triggers it, and release removes the entry', () => {
    const registry = new RunAbortRegistryService();
    const signal = registry.register('run-1');
    expect(signal.aborted).toBe(false);

    expect(registry.abort('run-1')).toBe(true);
    expect(signal.aborted).toBe(true);

    registry.release('run-1');
    expect(registry.abort('run-1')).toBe(false);
  });

  it('abort is idempotent for the same registered run', () => {
    const registry = new RunAbortRegistryService();
    const signal = registry.register('run-1');
    expect(registry.abort('run-1')).toBe(true);
    expect(registry.abort('run-1')).toBe(true);
    expect(signal.aborted).toBe(true);
    registry.release('run-1');
  });

  it('stores and reads sandbox snapshot for a run', () => {
    const registry = new RunAbortRegistryService();
    registry.register('run-1');
    registry.setPreGenerateSandboxSnapshot('run-1', {
      status: 'ready',
      experienceId: 'exp-1',
      experienceVersionId: 'ver-1',
    });
    expect(registry.getPreGenerateSandboxSnapshot('run-1')).toEqual({
      status: 'ready',
      experienceId: 'exp-1',
      experienceVersionId: 'ver-1',
    });
    registry.release('run-1');
    expect(registry.getPreGenerateSandboxSnapshot('run-1')).toBeUndefined();
  });
});
