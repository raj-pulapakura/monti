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
      operation: 'generate',
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
      operation: 'generate',
      prompt: 'Teach photosynthesis',
    });

    expect(result.fallbackReason).toBe('ROUTER_STAGE_DISABLED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends structured routing inputs and explicit tier guidance to the router model', async () => {
    process.env.ROUTER_STAGE_ENABLED = 'true';
    process.env.OPENAI_API_KEY = 'test-key';

    const fetchSpy = jest.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          output_text:
            '{"tier":"fast","confidence":0.81,"reason":"Straightforward single-concept request."}',
        }),
      }) as Response,
    );
    global.fetch = fetchSpy as unknown as typeof fetch;

    const service = new LlmDecisionRouterService(new LlmConfigService());
    const result = await service.decideRoute({
      requestId: 'run-3',
      operation: 'refine',
      prompt: 'Improve the simulator for mobile and clarify the feedback states',
      format: 'game',
      audience: 'university',
      conversationContext:
        'USER: make it feel more rigorous\nASSISTANT: I can refine the interaction loop.',
      refinementInstruction: 'Tighten the pacing and preserve the core concept.',
      hasPriorExperience: true,
    });

    expect(result.tier).toBe('fast');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(options.body);

    expect(body.model).toBe('gpt-5-mini');
    expect(body.reasoning).toEqual({ effort: 'minimal' });

    const systemText = body.input[0].content[0].text as string;
    expect(systemText).toContain('fast: routes to a faster, cheaper model');
    expect(systemText).toContain('quality: routes to a slower, more capable model');
    expect(systemText).toContain('Default to fast when uncertain.');
    expect(systemText).toContain('Topic complexity alone is not enough to justify quality.');

    const userText = body.input[1].content[0].text as string;
    expect(userText).toContain('Request summary:');
    expect(userText).toContain('- operation: refine');
    expect(userText).toContain('- format: game');
    expect(userText).toContain('- audience: university');
    expect(userText).toContain('- has_conversation_context: yes');
    expect(userText).toContain(
      '- refinement_instruction: Tighten the pacing and preserve the core concept.',
    );
    expect(userText).toContain('- prior_experience_available: yes');
    expect(userText).toContain('USER: make it feel more rigorous');
  });
});
