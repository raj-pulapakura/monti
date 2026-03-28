import { AppError } from '../../common/errors/app-error';
import { GenerateExperienceToolService } from './generate-experience-tool.service';

describe('GenerateExperienceToolService', () => {
  it('passes structured routing inputs and normalizes provider refusals', async () => {
    const decisionRouter = {
      decideRoute: jest.fn(async () => ({
        tier: 'quality' as const,
        confidence: 0.9,
        reason: 'Needs high quality',
        fallbackReason: null,
        selectedProvider: 'openai' as const,
        selectedModel: 'gpt-5.4',
      })),
    };
    const llmConfig = {
      resolveExecutionRoute: jest.fn((input: { tier: 'fast' | 'quality' }) => ({
        qualityMode: input.tier,
        provider: 'openai' as const,
        model: input.tier === 'fast' ? 'gpt-5-mini' : 'gpt-5.4',
      })),
    };

    const orchestrator = {
      generate: jest.fn(async () => {
        throw new AppError('PROVIDER_REFUSAL', 'Request refused by provider.', 422);
      }),
      refine: jest.fn(async () => {
        throw new Error('not expected');
      }),
    };

    const repository = {
      recordRunRoutingDecision: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => null),
      updateSandboxState: jest.fn(async () => undefined),
    };

    const service = new GenerateExperienceToolService(
      decisionRouter as never,
      llmConfig as never,
      orchestrator as never,
      repository as never,
    );

    const result = await service.execute({
      runId: 'run-1',
      threadId: 'thread-1',
      userId: 'client-1',
      arguments: {
        operation: 'generate',
        prompt: 'Build a solar system game',
        conversationContext: 'USER: teach planets\nASSISTANT: I can generate an experience.',
      },
    });

    expect(decisionRouter.decideRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'generate',
        prompt: 'Build a solar system game',
        conversationContext:
          'USER: teach planets\nASSISTANT: I can generate an experience.',
        format: undefined,
        audience: undefined,
        refinementInstruction: undefined,
        hasPriorExperience: false,
      }),
    );
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('PROVIDER_REFUSAL');
    expect(result.sandboxStatus).toBe('error');
    expect(llmConfig.resolveExecutionRoute).not.toHaveBeenCalled();
    expect(repository.updateSandboxState).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-1',
        status: 'error',
      }),
    );
  });

  it('bypasses the router when a quality mode is explicitly requested', async () => {
    const decisionRouter = {
      decideRoute: jest.fn(async () => {
        throw new Error('router should not run');
      }),
    };
    const llmConfig = {
      resolveExecutionRoute: jest.fn((input: { tier: 'fast' | 'quality' }) => ({
        qualityMode: input.tier,
        provider: 'gemini' as const,
        model:
          input.tier === 'fast'
            ? 'gemini-3.1-flash-lite-preview'
            : 'gemini-3.1-pro-preview',
      })),
    };
    const orchestrator = {
      generate: jest.fn(async () => ({
        metadata: {
          generationId: 'gen-1',
        },
      })),
      refine: jest.fn(async () => {
        throw new Error('not expected');
      }),
    };
    const repository = {
      recordRunRoutingDecision: jest.fn(async () => undefined),
      findExperienceVersionByGenerationId: jest.fn(async () => null),
      updateSandboxState: jest.fn(async () => undefined),
    };

    const service = new GenerateExperienceToolService(
      decisionRouter as never,
      llmConfig as never,
      orchestrator as never,
      repository as never,
    );

    const result = await service.execute({
      runId: 'run-2',
      threadId: 'thread-2',
      userId: 'client-2',
      requestedQualityMode: 'quality',
      arguments: {
        operation: 'generate',
        prompt: 'Build a rigorous probability simulator',
      },
    });

    expect(decisionRouter.decideRoute).not.toHaveBeenCalled();
    expect(llmConfig.resolveExecutionRoute).toHaveBeenCalledWith({
      tier: 'quality',
    });
    expect(repository.recordRunRoutingDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        tier: 'quality',
        confidence: 1,
        reason: 'User selected quality mode.',
        selectedProvider: 'gemini',
        selectedModel: 'gemini-3.1-pro-preview',
      }),
    );
    expect(orchestrator.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        qualityMode: 'quality',
        provider: 'gemini',
      }),
    );
    expect(result.route).toEqual(
      expect.objectContaining({
        tier: 'quality',
        confidence: 1,
        reason: 'User selected quality mode.',
        selectedProvider: 'gemini',
        selectedModel: 'gemini-3.1-pro-preview',
      }),
    );
  });
});
