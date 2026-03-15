import { AppError } from '../../common/errors/app-error';
import { GenerateExperienceToolService } from './generate-experience-tool.service';

describe('GenerateExperienceToolService', () => {
  it('uses prompt + conversation context for routing and normalizes provider refusals', async () => {
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
      orchestrator as never,
      repository as never,
    );

    const result = await service.execute({
      runId: 'run-1',
      threadId: 'thread-1',
      clientId: 'client-1',
      arguments: {
        operation: 'generate',
        prompt: 'Build a solar system game',
        conversationContext: 'USER: teach planets\nASSISTANT: I can generate an experience.',
      },
    });

    expect(decisionRouter.decideRoute).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Conversation context:'),
      }),
    );
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('PROVIDER_REFUSAL');
    expect(result.sandboxStatus).toBe('error');
    expect(repository.updateSandboxState).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: 'thread-1',
        status: 'error',
      }),
    );
  });
});
