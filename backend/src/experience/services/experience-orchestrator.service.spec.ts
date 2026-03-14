import {
  ProviderResponseError,
  SafetyViolationError,
} from '../../common/errors/app-error';
import { LlmConfigService } from '../../llm/llm-config.service';
import type { RoutedGenerationRequest } from '../../llm/llm-router.service';
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

describe('ExperienceOrchestratorService', () => {
  const promptBuilder = new PromptBuilderService();
  const llmConfig = new LlmConfigService();
  const payloadValidation = new PayloadValidationService(llmConfig);
  const safetyGuard = new SafetyGuardService();

  it('rejects malformed payloads', async () => {
    const llmRouter = new FakeLlmRouterService('{"title":"Only title"}');
    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
    );

    await expect(
      service.generate({
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);
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

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
    );

    await expect(
      service.generate({
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(ProviderResponseError);
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

    const service = new ExperienceOrchestratorService(
      llmConfig,
      llmRouter as never,
      promptBuilder,
      payloadValidation,
      safetyGuard,
    );

    await expect(
      service.generate({
        prompt: 'Build a quiz',
        qualityMode: 'fast',
      }),
    ).rejects.toBeInstanceOf(SafetyViolationError);
  });
});
