import { Injectable } from '@nestjs/common';
import type { SandboxStatus } from '../runtime.enums';

export type PreGenerateSandboxSnapshot = {
  status: SandboxStatus;
  experienceId: string | null;
  experienceVersionId: string | null;
};

type RunAbortEntry = {
  controller: AbortController;
  preGenerateSandboxSnapshot?: PreGenerateSandboxSnapshot;
};

@Injectable()
export class RunAbortRegistryService {
  private readonly entries = new Map<string, RunAbortEntry>();

  register(runId: string): AbortSignal {
    const existing = this.entries.get(runId);
    if (existing) {
      existing.controller.abort();
    }
    const controller = new AbortController();
    this.entries.set(runId, { controller });
    return controller.signal;
  }

  setPreGenerateSandboxSnapshot(runId: string, snapshot: PreGenerateSandboxSnapshot): void {
    const entry = this.entries.get(runId);
    if (entry) {
      entry.preGenerateSandboxSnapshot = snapshot;
    }
  }

  getPreGenerateSandboxSnapshot(runId: string): PreGenerateSandboxSnapshot | undefined {
    return this.entries.get(runId)?.preGenerateSandboxSnapshot;
  }

  /** Returns true if a controller was registered for this run (abort may already have been called). */
  abort(runId: string): boolean {
    const entry = this.entries.get(runId);
    if (!entry) {
      return false;
    }
    entry.controller.abort();
    return true;
  }

  release(runId: string): void {
    this.entries.delete(runId);
  }
}
