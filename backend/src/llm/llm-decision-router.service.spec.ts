import { LlmConfigService } from './llm-config.service';
import { LlmDecisionRouterService } from './llm-decision-router.service';

describe('LlmDecisionRouterService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.ROUTER_STAGE_ENABLED;
    delete process.env.OPENAI_API_KEY;
  });

  it('falls back when router output is invalid', async () => {
    process.env.ROUTER_STAGE_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'test-key';

    global.fetch = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          output_text: '{}',
        }),
      }) as Response,
    );

    const service = new LlmDecisionRouterService(new LlmConfigService());
    const result = await service.decideRoute({
      requestId: 'run-1',
      prompt: 'Teach solar system',
    });

    expect(result.tier).toBe('fast');
    expect(result.fallbackReason).toBeTruthy();
    expect(result.selectedProvider).toBeTruthy();
    expect(result.selectedModel).toBeTruthy();
  });

  it('uses fallback immediately when router stage is disabled', async () => {
    process.env.ROUTER_STAGE_ENABLED = 'false';

    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new LlmDecisionRouterService(new LlmConfigService());
    const result = await service.decideRoute({
      requestId: 'run-2',
      prompt: 'Teach photosynthesis',
    });

    expect(result.fallbackReason).toBe('ROUTER_STAGE_DISABLED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
