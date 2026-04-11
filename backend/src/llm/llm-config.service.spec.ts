describe('LlmConfigService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CONVERSATION_CONTEXT_WINDOW_SIZE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('conversationContextWindowSize', () => {
    it('defaults to 20 when the env var is unset', () => {
      const { LlmConfigService } = require('./llm-config.service');
      expect(new LlmConfigService().conversationContextWindowSize).toBe(20);
    });

    it('uses a valid positive integer from CONVERSATION_CONTEXT_WINDOW_SIZE', () => {
      process.env.CONVERSATION_CONTEXT_WINDOW_SIZE = '7';
      const { LlmConfigService } = require('./llm-config.service');
      expect(new LlmConfigService().conversationContextWindowSize).toBe(7);
    });

    it('falls back to 20 for non-positive or non-numeric values', () => {
      process.env.CONVERSATION_CONTEXT_WINDOW_SIZE = '0';
      const { LlmConfigService: S1 } = require('./llm-config.service');
      expect(new S1().conversationContextWindowSize).toBe(20);

      jest.resetModules();
      process.env = { ...originalEnv, CONVERSATION_CONTEXT_WINDOW_SIZE: '-3' };
      const { LlmConfigService: S2 } = require('./llm-config.service');
      expect(new S2().conversationContextWindowSize).toBe(20);

      jest.resetModules();
      process.env = { ...originalEnv, CONVERSATION_CONTEXT_WINDOW_SIZE: 'not-a-number' };
      const { LlmConfigService: S3 } = require('./llm-config.service');
      expect(new S3().conversationContextWindowSize).toBe(20);
    });
  });
});
