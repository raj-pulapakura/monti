import {
  buildAnthropicToolRequest,
  parseAnthropicToolResponse,
} from './providers/anthropic-native-tool.adapter';
import {
  buildGeminiToolRequest,
  parseGeminiToolResponse,
} from './providers/gemini-native-tool.adapter';
import {
  buildOpenAiToolRequest,
  parseOpenAiToolResponse,
} from './providers/openai-native-tool.adapter';

type ParserFixture = {
  provider: 'openai' | 'anthropic' | 'gemini';
  parse: (payload: unknown) => {
    assistantText: string;
    toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
    finishReason: 'stop' | 'tool_calls' | 'max_tokens' | 'unknown';
  };
  payload: unknown;
  expectedToolName: string;
};

describe('Native Tool Adapter Contract', () => {
  const toolCallFixtures: ParserFixture[] = [
    {
      provider: 'openai',
      parse: parseOpenAiToolResponse as ParserFixture['parse'],
      payload: {
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'generate_experience',
            call_id: 'call_1',
            arguments: '{"prompt":"solar system"}',
          },
        ],
      },
      expectedToolName: 'generate_experience',
    },
    {
      provider: 'anthropic',
      parse: parseAnthropicToolResponse as ParserFixture['parse'],
      payload: {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'generate_experience',
            input: { prompt: 'solar system' },
          },
        ],
      },
      expectedToolName: 'generate_experience',
    },
    {
      provider: 'gemini',
      parse: parseGeminiToolResponse as ParserFixture['parse'],
      payload: {
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  functionCall: {
                    name: 'generate_experience',
                    args: { prompt: 'solar system' },
                  },
                },
              ],
            },
          },
        ],
      },
      expectedToolName: 'generate_experience',
    },
  ];

  for (const fixture of toolCallFixtures) {
    it(`${fixture.provider} parser normalizes tool-call output`, () => {
      const parsed = fixture.parse(fixture.payload);

      expect(parsed.toolCalls).toHaveLength(1);
      expect(parsed.toolCalls[0].name).toBe(fixture.expectedToolName);
      expect(parsed.toolCalls[0].arguments).toEqual({ prompt: 'solar system' });
      expect(parsed.finishReason).toBe('tool_calls');
    });
  }

  it('normalizes text-only responses with stop semantics', () => {
    const openAiParsed = parseOpenAiToolResponse({
      status: 'completed',
      output_text: 'Done',
      output: [],
    });
    const anthropicParsed = parseAnthropicToolResponse({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'Done' }],
    });
    const geminiParsed = parseGeminiToolResponse({
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [{ text: 'Done' }],
          },
        },
      ],
    });

    expect(openAiParsed.assistantText).toBe('Done');
    expect(openAiParsed.finishReason).toBe('stop');
    expect(openAiParsed.toolCalls).toHaveLength(0);

    expect(anthropicParsed.assistantText).toBe('Done');
    expect(anthropicParsed.finishReason).toBe('stop');
    expect(anthropicParsed.toolCalls).toHaveLength(0);

    expect(geminiParsed.assistantText).toBe('Done');
    expect(geminiParsed.finishReason).toBe('stop');
    expect(geminiParsed.toolCalls).toHaveLength(0);
  });

  it('builds provider-native tool call and tool result payloads from canonical message history', () => {
    const toolCallHistory = {
      requestId: 'run-1',
      provider: 'openai' as const,
      model: 'gpt-5.4',
      maxTokens: 2048,
      messages: [
        { role: 'system' as const, content: 'You are Monti' },
        { role: 'user' as const, content: 'Build a quiz' },
        {
          role: 'assistant' as const,
          content: 'On it.',
          toolCalls: [
            {
              id: 'call_1',
              name: 'generate_experience',
              arguments: { prompt: 'Build a quiz', operation: 'generate' },
            },
          ],
        },
        {
          role: 'tool' as const,
          content: '{"status":"succeeded","operation":"generate"}',
          toolCallId: 'call_1',
          toolName: 'generate_experience',
        },
      ],
      tools: [
        {
          name: 'generate_experience',
          description: 'generate',
          inputSchema: { type: 'object' },
        },
      ],
    };

    const openAi = buildOpenAiToolRequest(toolCallHistory);
    const anthropic = buildAnthropicToolRequest({
      ...toolCallHistory,
      provider: 'anthropic',
    });
    const gemini = buildGeminiToolRequest({
      ...toolCallHistory,
      provider: 'gemini',
    });

    expect(openAi).toMatchObject({
      input: expect.arrayContaining([
        { role: 'system', content: 'You are Monti' },
        { role: 'user', content: 'Build a quiz' },
        { role: 'assistant', content: 'On it.' },
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_1',
          name: 'generate_experience',
        }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_1',
        }),
      ]),
    });

    expect(anthropic).toMatchObject({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'tool_use', id: 'call_1' }),
          ]),
        }),
        expect.objectContaining({
          role: 'user',
          content: expect.arrayContaining([
            expect.objectContaining({
              type: 'tool_result',
              tool_use_id: 'call_1',
            }),
          ]),
        }),
      ]),
    });

    expect(gemini).toMatchObject({
      contents: expect.arrayContaining([
        expect.objectContaining({
          role: 'model',
          parts: expect.arrayContaining([
            expect.objectContaining({
              functionCall: expect.objectContaining({
                name: 'generate_experience',
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          role: 'user',
          parts: expect.arrayContaining([
            expect.objectContaining({
              functionResponse: expect.objectContaining({
                name: 'generate_experience',
              }),
            }),
          ]),
        }),
      ]),
    });
  });
});
