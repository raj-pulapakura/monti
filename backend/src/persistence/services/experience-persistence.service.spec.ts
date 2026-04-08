import { ValidationError } from '../../common/errors/app-error';
import { observedUsage, unavailableUsage } from '../../llm/llm-usage';
import { ExperiencePersistenceService } from './experience-persistence.service';

describe('ExperiencePersistenceService', () => {
  const basePayload = {
    title: 'Solar Quest',
    description: 'Learn planets with a game.',
    html: '<main>Hi</main>',
    css: 'main{font-size:16px;}',
    js: 'console.log("hello")',
  };

  function createRepositoryMock() {
    return {
      createRun: jest.fn(async () => undefined),
      markRunSucceeded: jest.fn(async () => undefined),
      markRunFailed: jest.fn(async () => undefined),
      createExperience: jest.fn(async () => 'experience-1'),
      findVersionByGenerationId: jest.fn(
        async (): Promise<{
          id: string;
          experienceId: string;
          versionNumber: number;
        } | null> => null,
      ),
      createVersion: jest.fn(async () => 'version-1'),
    };
  }

  it('persists a successful generation as version 1', async () => {
    const repository = createRepositoryMock();
    const service = new ExperiencePersistenceService(repository as never);

    await service.persistSuccess({
      requestId: '6f8f7e0f-3fda-4f26-aec2-624ec5ebf0d6',
      operation: 'generate',
      userId: 'client-1',
      prompt: 'Teach my kid the solar system.',
      qualityMode: 'fast',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite-preview',
      maxTokens: 8192,
      requestUsage: observedUsage({
        inputTokens: 910,
        outputTokens: 3010,
      }),
      successfulAttemptUsage: observedUsage({
        inputTokens: 900,
        outputTokens: 3000,
      }),
      attemptCount: 1,
      experience: basePayload,
      latencyMs: 1200,
    });

    expect(repository.createExperience).toHaveBeenCalledWith({
      userId: 'client-1',
      title: 'Solar Quest',
    });
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '6f8f7e0f-3fda-4f26-aec2-624ec5ebf0d6',
        experienceId: 'experience-1',
        parentGenerationId: null,
        versionNumber: 1,
        operation: 'generate',
        tokensIn: 900,
        tokensOut: 3000,
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: '6f8f7e0f-3fda-4f26-aec2-624ec5ebf0d6',
        experienceId: 'experience-1',
        versionId: 'version-1',
        attemptCount: 1,
        requestTokensIn: 910,
        requestTokensOut: 3010,
      }),
    );
  });

  it('leaves request and artifact token totals unavailable when usage is unavailable', async () => {
    const repository = createRepositoryMock();
    const service = new ExperiencePersistenceService(repository as never);

    await service.persistSuccess({
      requestId: '0d1e8e85-8dd6-4a7a-b795-a4469dd5674f',
      operation: 'generate',
      userId: 'client-1',
      prompt: 'Teach my kid the solar system.',
      qualityMode: 'fast',
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite-preview',
      maxTokens: 8192,
      requestUsage: unavailableUsage(),
      successfulAttemptUsage: unavailableUsage(),
      attemptCount: 1,
      experience: basePayload,
      latencyMs: 1200,
    });

    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        tokensIn: null,
        tokensOut: null,
      }),
    );
    expect(repository.markRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCount: 1,
        requestTokensIn: null,
        requestTokensOut: null,
      }),
    );
  });

  it('rejects refinement persistence without prior generation id', async () => {
    const repository = createRepositoryMock();
    const service = new ExperiencePersistenceService(repository as never);

    await expect(
      service.persistSuccess({
        requestId: 'd8006296-f071-48e6-b629-243f76dc3b40',
        operation: 'refine',
        userId: 'client-1',
        prompt: 'Teach my kid the solar system.',
        refinementInstruction: 'Use simpler language.',
        qualityMode: 'quality',
        provider: 'openai',
        model: 'gpt-5.4',
        maxTokens: 8192,
        requestUsage: observedUsage({
          inputTokens: 200,
          outputTokens: 75,
        }),
        successfulAttemptUsage: observedUsage({
          inputTokens: 200,
          outputTokens: 75,
        }),
        attemptCount: 1,
        experience: basePayload,
        latencyMs: 800,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('persists refinement as next linked version', async () => {
    const repository = createRepositoryMock();
    repository.findVersionByGenerationId.mockResolvedValue({
      id: 'version-2',
      experienceId: 'experience-1',
      versionNumber: 2,
    });
    repository.createVersion.mockResolvedValue('version-3');

    const service = new ExperiencePersistenceService(repository as never);

    await service.persistSuccess({
      requestId: 'f0443e3b-5505-467b-82f1-c64c97a4ced9',
      operation: 'refine',
      userId: 'client-1',
      prompt: 'Teach my kid the solar system.',
      refinementInstruction: 'Use simpler language.',
      parentGenerationId: 'a7ce8286-3d1d-42d7-b27a-56adf57edfd6',
      qualityMode: 'quality',
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-latest',
      maxTokens: 8192,
      requestUsage: observedUsage({
        inputTokens: 400,
        outputTokens: 180,
      }),
      successfulAttemptUsage: observedUsage({
        inputTokens: 250,
        outputTokens: 120,
      }),
      attemptCount: 2,
      experience: basePayload,
      latencyMs: 700,
    });

    expect(repository.findVersionByGenerationId).toHaveBeenCalledWith(
      'a7ce8286-3d1d-42d7-b27a-56adf57edfd6',
    );
    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        experienceId: 'experience-1',
        parentGenerationId: 'a7ce8286-3d1d-42d7-b27a-56adf57edfd6',
        versionNumber: 3,
        operation: 'refine',
        tokensIn: 250,
        tokensOut: 120,
      }),
    );
  });

  it('rejects refinement when prior generation is not persisted', async () => {
    const repository = createRepositoryMock();
    repository.findVersionByGenerationId.mockResolvedValue(null);
    const service = new ExperiencePersistenceService(repository as never);

    await expect(
      service.persistSuccess({
        requestId: '93f1f0cc-e704-4eba-bcb7-249bf73ad33d',
        operation: 'refine',
        userId: 'client-1',
        prompt: 'Teach my kid the solar system.',
        refinementInstruction: 'Use simpler language.',
        parentGenerationId: 'ab5b9ec6-17e4-4dbf-9bab-7db66e82b4ea',
        qualityMode: 'quality',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-latest',
        maxTokens: 8192,
        requestUsage: observedUsage({
          inputTokens: 200,
          outputTokens: 75,
        }),
        successfulAttemptUsage: observedUsage({
          inputTokens: 200,
          outputTokens: 75,
        }),
        attemptCount: 1,
        experience: basePayload,
        latencyMs: 700,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
