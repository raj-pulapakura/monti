import {
  AppError,
  ProviderMaxTokensError,
  ProviderResponseError,
  SafetyViolationError,
} from '../../common/errors/app-error';
import { LlmConfigService } from '../../llm/llm-config.service';
import { observedUsage, unavailableUsage } from '../../llm/llm-usage';
import type { RoutedGenerationRequest } from '../../llm/llm-router.service';
import { ExperiencePersistenceService } from '../../persistence/services/experience-persistence.service';
import { SafetyGuardService } from '../../safety/safety-guard.service';
import { PayloadValidationService } from '../../validation/payload-validation.service';
import { ExperienceOrchestratorService } from './experience-orchestrator.service';
import { PromptBuilderService } from './prompt-builder.service';

type FakeRouterStep =
  | {
      provider: 'openai';
      model: string;
      rawText: string;
      usage: ReturnType<typeof observedUsage> | ReturnType<typeof unavailableUsage>;
    }
  | Error;

class FakeLlmRouterService {
  private readonly steps: FakeRouterStep[];
  private index = 0;

  constructor(rawTextOrSteps: string | FakeRouterStep[]) {
    this.steps = Array.isArray(rawTextOrSteps)
      ? rawTextOrSteps
      : [
          {
            provider: 'openai',
            model: 'gpt-5-mini',
            rawText: rawTextOrSteps,
            usage: observedUsage({
              inputTokens: 900,
              outputTokens: 3000,
            }),
          },
        ];
  }

  async generateStructured(_request: RoutedGenerationRequest) {
    const step = this.steps[Math.min(this.index, this.steps.length - 1)];
    this.index += 1;

    if (step instanceof Error) {
      throw step;
    }

    return step;
  }
}

class FakePersistenceService {
  readonly startedRuns: Array<{ requestId: string; userId: string }> = [];
  readonly successfulWrites: Array<{
    requestId: string;
    operation: 'generate' | 'refine';
    attemptCount: number;
    requestUsage: unknown;
    successfulAttemptUsage: unknown;
  }> = [];
  readonly failedRuns: Array<{
    requestId: string;
    errorMessage: string;
    attemptCount: number;
    requestUsage: unknown;
  }> = [];

  constructor(private readonly failPersist = false) {}

  async recordRunStarted(input: {
    requestId: string;
    userId: string;
  }): Promise<void> {
    this.startedRuns.push(input);
  }

  async persistSuccess(input: {
    requestId: string;
    operation: 'generate' | 'refine';
    attemptCount: number;
    requestUsage: unknown;
    successfulAttemptUsage: unknown;
  }): Promise<void> {
    if (this.failPersist) {
      throw new AppError('INTERNAL_ERROR', 'Persistence failed.');
    }
    this.successfulWrites.push(input);
  }

  async recordRunFailed(input: {
    requestId: string;
    errorMessage: string;
    attemptCount: number;
    requestUsage: unknown;
  }): Promise<void> {
    this.failedRuns.push(input);
  }
}

describe('ExperienceOrchestratorService', () => {
  const promptBuilder = new PromptBuilderService();
  const llmConfig = new LlmConfigService();
  const payloadValidation = new PayloadValidationService(llmConfig);
  const safetyGuard = new SafetyGuardService();

  it('rejects malformed payloads', async () => {
    const llmRouter = new FakeLlmRouterService('{"title":"Only title"}');
    const persistence = new FakePersistenceService();
    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await expect(
      service.generate({
        userId: 'test-client',
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);

    expect(persistence.startedRuns).toHaveLength(1);
    expect(persistence.failedRuns).toHaveLength(1);
  });

  it('rejects oversized payload parts', async () => {
    const hugeHtml = 'a'.repeat(llmConfig.maxPartChars + 1);
    const llmRouter = new FakeLlmRouterService(
      JSON.stringify({
        title: 'Huge payload',
        description: 'Description',
        html: hugeHtml,
        css: '.x{}',
        js: 'console.log(1);',
      }),
    );
    const persistence = new FakePersistenceService();

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await expect(
      service.generate({
        userId: 'test-client',
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);

    expect(persistence.failedRuns).toHaveLength(1);
  });

  it('rejects payloads that violate safety guard rules', async () => {
    const llmRouter = new FakeLlmRouterService(
      JSON.stringify({
        title: 'Unsafe payload',
        description: 'Description',
        html: '<main>Unsafe</main>',
        css: '.x{}',
        js: 'fetch("https://example.com")',
      }),
    );
    const persistence = new FakePersistenceService();

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await expect(
      service.generate({
        userId: 'test-client',
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(SafetyViolationError);

    expect(persistence.failedRuns).toHaveLength(1);
  });

  it('persists successful generation', async () => {
    const llmRouter = new FakeLlmRouterService(
      JSON.stringify({
        title: 'Valid payload',
        description: 'Description',
        html: '<main>Hello</main>',
        css: 'main{color:black;}',
        js: 'console.log("ok")',
      }),
    );
    const persistence = new FakePersistenceService();

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    const result = await service.generate({
      userId: 'test-client',
      prompt: 'Build a quiz',
      qualityMode: 'fast',
      format: 'quiz',
      audience: 'elementary',
    });

    expect(result.experience.title).toBe('Valid payload');
    expect(persistence.startedRuns).toHaveLength(1);
    expect(persistence.successfulWrites).toHaveLength(1);
    expect(persistence.successfulWrites[0]).toMatchObject({
      attemptCount: 1,
      requestUsage: {
        availability: 'observed',
        inputTokens: 900,
        outputTokens: 3000,
      },
      successfulAttemptUsage: {
        availability: 'observed',
        inputTokens: 900,
        outputTokens: 3000,
      },
    });
    expect(persistence.failedRuns).toHaveLength(0);
  });

  it('aggregates retry usage across attempts when each attempt is observed', async () => {
    const llmRouter = new FakeLlmRouterService([
      new ProviderMaxTokensError('too small', {
        usage: observedUsage({
          inputTokens: 400,
          outputTokens: 200,
        }),
      }),
      {
        provider: 'openai',
        model: 'gpt-5-mini',
        rawText: JSON.stringify({
          title: 'Valid payload',
          description: 'Description',
          html: '<main>Hello</main>',
          css: 'main{color:black;}',
          js: 'console.log("ok")',
        }),
        usage: observedUsage({
          inputTokens: 600,
          outputTokens: 900,
        }),
      },
    ]);
    const persistence = new FakePersistenceService();
    const retryingConfig = {
      ...llmConfig,
      maxTokensDefault: 1024,
      maxTokensRetry: 4096,
      providerFor: llmConfig.providerFor.bind(llmConfig),
    };

    const service = new ExperienceOrchestratorService(
      retryingConfig as never,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await service.generate({
      userId: 'test-client',
      prompt: 'Build a quiz',
      qualityMode: 'fast',
    });

    expect(persistence.successfulWrites).toHaveLength(1);
    expect(persistence.successfulWrites[0]).toMatchObject({
      attemptCount: 2,
      requestUsage: {
        availability: 'observed',
        inputTokens: 1000,
        outputTokens: 1100,
      },
      successfulAttemptUsage: {
        availability: 'observed',
        inputTokens: 600,
        outputTokens: 900,
      },
    });
  });

  it('records unavailable request usage when a failed attempt does not expose usage', async () => {
    const llmRouter = new FakeLlmRouterService([
      new ProviderResponseError('provider failed'),
    ]);
    const persistence = new FakePersistenceService();

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await expect(
      service.generate({
        userId: 'test-client',
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);

    expect(persistence.failedRuns).toHaveLength(1);
    expect(persistence.failedRuns[0]).toMatchObject({
      attemptCount: 1,
      requestUsage: {
        availability: 'unavailable',
        inputTokens: null,
        outputTokens: null,
      },
    });
  });

  it('records run failure when persistence write fails', async () => {
    const llmRouter = new FakeLlmRouterService(
      JSON.stringify({
        title: 'Valid payload',
        description: 'Description',
        html: '<main>Hello</main>',
        css: 'main{color:black;}',
        js: 'console.log("ok")',
      }),
    );
    const persistence = new FakePersistenceService(true);

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
      persistence as never as ExperiencePersistenceService,
    );

    await expect(
      service.generate({
        userId: 'test-client',
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(AppError);

    expect(persistence.startedRuns).toHaveLength(1);
    expect(persistence.failedRuns).toHaveLength(1);
    expect(persistence.failedRuns[0]).toMatchObject({
      attemptCount: 1,
      requestUsage: {
        availability: 'observed',
        inputTokens: 900,
        outputTokens: 3000,
      },
    });
  });
});
