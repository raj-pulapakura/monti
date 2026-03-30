import {
  normalizeAnthropicUsage,
  normalizeGeminiUsage,
  normalizeOpenAiUsage,
} from './provider-usage';

describe('provider usage normalization', () => {
  it('normalizes observed OpenAI usage', () => {
    expect(
      normalizeOpenAiUsage({
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
      }),
    ).toEqual({
      availability: 'observed',
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      rawUsage: {
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
      },
    });
  });

  it('marks missing OpenAI usage as unavailable', () => {
    expect(
      normalizeOpenAiUsage({
        input_tokens: 120,
      }),
    ).toEqual({
      availability: 'unavailable',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      rawUsage: {
        input_tokens: 120,
      },
    });
  });

  it('normalizes observed Anthropic usage', () => {
    expect(
      normalizeAnthropicUsage({
        input_tokens: 88,
        output_tokens: 19,
      }),
    ).toEqual({
      availability: 'observed',
      inputTokens: 88,
      outputTokens: 19,
      totalTokens: 107,
      rawUsage: {
        input_tokens: 88,
        output_tokens: 19,
      },
    });
  });

  it('marks missing Anthropic usage as unavailable', () => {
    expect(
      normalizeAnthropicUsage({
        output_tokens: 19,
      }),
    ).toEqual({
      availability: 'unavailable',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      rawUsage: {
        output_tokens: 19,
      },
    });
  });

  it('normalizes observed Gemini usage', () => {
    expect(
      normalizeGeminiUsage({
        promptTokenCount: 300,
        candidatesTokenCount: 75,
        totalTokenCount: 375,
      }),
    ).toEqual({
      availability: 'observed',
      inputTokens: 300,
      outputTokens: 75,
      totalTokens: 375,
      rawUsage: {
        promptTokenCount: 300,
        candidatesTokenCount: 75,
        totalTokenCount: 375,
      },
    });
  });

  it('marks missing Gemini usage as unavailable', () => {
    expect(
      normalizeGeminiUsage({
        promptTokenCount: 300,
      }),
    ).toEqual({
      availability: 'unavailable',
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      rawUsage: {
        promptTokenCount: 300,
      },
    });
  });
});
