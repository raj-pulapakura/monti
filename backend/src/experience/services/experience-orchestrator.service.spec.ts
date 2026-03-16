import {
  AppError,
  ProviderResponseError,
  SafetyViolationError,
} from '../../common/errors/app-error';
import { LlmConfigService } from '../../llm/llm-config.service';
import type { RoutedGenerationRequest } from '../../llm/llm-router.service';
import { ExperiencePersistenceService } from '../../persistence/services/experience-persistence.service';
import { SafetyGuardService } from '../../safety/safety-guard.service';
import { PayloadValidationService } from '../../validation/payload-validation.service';
import { ExperienceOrchestratorService } from './experience-orchestrator.service';
import { PromptBuilderService } from './prompt-builder.service';

class FakeLlmRouterService {
  constructor(private readonly rawText: string) {}

  async generateStructured(_request: RoutedGenerationRequest) {
    return {
      provider: 'openai' as const,
      model: 'gpt-5-mini',
      rawText: this.rawText,
    };
  }
}

class FakePersistenceService {
  readonly startedRuns: Array<{ requestId: string; userId: string }> = [];
  readonly successfulWrites: Array<{ requestId: string; operation: 'generate' | 'refine' }> = [];
  readonly failedRuns: Array<{ requestId: string; errorMessage: string }> = [];

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
  }): Promise<void> {
    if (this.failPersist) {
      throw new AppError('INTERNAL_ERROR', 'Persistence failed.');
    }
    this.successfulWrites.push(input);
  }

  async recordRunFailed(input: {
    requestId: string;
    errorMessage: string;
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
    expect(persistence.failedRuns).toHaveLength(0);
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
  });
});
