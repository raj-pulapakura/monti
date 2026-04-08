import { RefinementSuggestionService } from './refinement-suggestion.service';
import { ValidationError } from '../../common/errors/app-error';

function createVersion(overrides: Record<string, unknown> = {}) {
  return {
    experience_id: 'exp-1',
    description: 'An interactive quiz about fractions for middle schoolers.',
    html: '<h1>Fractions Quiz</h1><p>Question 1: What is 1/2 + 1/4?</p>',
    ...overrides,
  };
}

function createExperience(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Fractions Quiz',
    ...overrides,
  };
}

function makeClientStub(overrides: {
  thread?: unknown;
  version?: unknown;
  experience?: unknown;
  messages?: unknown[];
} = {}) {
  const fromMap: Record<string, unknown> = {};

  function buildChain(result: unknown) {
    const chain: Record<string, () => unknown> = {};
    const terminal = { data: result, error: null };
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.maybeSingle = () => Promise.resolve(terminal);
    return chain;
  }

  const threadData = 'thread' in overrides ? overrides.thread : { id: 'thread-1' };
  const versionData = 'version' in overrides ? overrides.version : createVersion();
  const experienceData =
    'experience' in overrides ? overrides.experience : createExperience();

  fromMap['chat_threads'] = buildChain(threadData);
  fromMap['experience_versions'] = buildChain(versionData);
  fromMap['experiences'] = buildChain(experienceData);
  fromMap['chat_messages'] = {
    select: () => fromMap['chat_messages'],
    eq: () => fromMap['chat_messages'],
    order: () => fromMap['chat_messages'],
    limit: () =>
      Promise.resolve({ data: overrides.messages ?? [], error: null }),
  };

  return {
    from: (table: string) => fromMap[table],
  };
}

describe('RefinementSuggestionService', () => {
  it('returns parsed suggestions from the LLM', async () => {
    const client = makeClientStub({
      messages: [{ content: 'Make it a quiz', role: 'user' }],
    });

    const llmRouter = {
      generateStructured: jest.fn(async () => ({
        rawText: JSON.stringify({
          suggestions: [
            { label: 'Add a timer', prompt: 'Add a countdown timer to each question.' },
            { label: 'More questions', prompt: 'Add 5 more questions about fractions.' },
          ],
        }),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        usage: { tokensIn: 100, tokensOut: 50 },
      })),
    };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    const result = await service.getSuggestions({
      threadId: 'thread-1',
      userId: 'user-1',
      experienceVersionId: 'version-1',
    });

    expect(llmRouter.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ qualityMode: 'fast', responseSchema: expect.objectContaining({ type: 'object' }) }),
    );
    expect(result).toEqual([
      { label: 'Add a timer', prompt: 'Add a countdown timer to each question.' },
      { label: 'More questions', prompt: 'Add 5 more questions about fractions.' },
    ]);
  });

  it('throws ValidationError when thread does not belong to user', async () => {
    const client = makeClientStub({ thread: null });
    const llmRouter = { generateStructured: jest.fn() };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    await expect(
      service.getSuggestions({
        threadId: 'thread-1',
        userId: 'wrong-user',
        experienceVersionId: 'version-1',
      }),
    ).rejects.toThrow(ValidationError);

    expect(llmRouter.generateStructured).not.toHaveBeenCalled();
  });

  it('returns empty array when experience version is not found', async () => {
    const client = makeClientStub({ version: null });
    const llmRouter = { generateStructured: jest.fn() };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    const result = await service.getSuggestions({
      threadId: 'thread-1',
      userId: 'user-1',
      experienceVersionId: 'version-missing',
    });

    expect(result).toEqual([]);
    expect(llmRouter.generateStructured).not.toHaveBeenCalled();
  });

  it('returns empty array and does not throw when LLM call fails', async () => {
    const client = makeClientStub({});
    const llmRouter = {
      generateStructured: jest.fn(async () => {
        throw new Error('Provider timeout');
      }),
    };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    const result = await service.getSuggestions({
      threadId: 'thread-1',
      userId: 'user-1',
      experienceVersionId: 'version-1',
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when LLM returns malformed JSON', async () => {
    const client = makeClientStub({});
    const llmRouter = {
      generateStructured: jest.fn(async () => ({
        rawText: 'Sorry, I cannot help with that.',
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        usage: { tokensIn: 50, tokensOut: 20 },
      })),
    };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    const result = await service.getSuggestions({
      threadId: 'thread-1',
      userId: 'user-1',
      experienceVersionId: 'version-1',
    });

    expect(result).toEqual([]);
  });

  it('caps suggestions at 4 even if LLM returns more', async () => {
    const client = makeClientStub({});
    const llmRouter = {
      generateStructured: jest.fn(async () => ({
        rawText: JSON.stringify({
          suggestions: [
            { label: 'A', prompt: 'Prompt A' },
            { label: 'B', prompt: 'Prompt B' },
            { label: 'C', prompt: 'Prompt C' },
            { label: 'D', prompt: 'Prompt D' },
            { label: 'E', prompt: 'Prompt E' },
          ],
        }),
        provider: 'anthropic',
        model: 'claude-haiku-4-5',
        usage: { tokensIn: 100, tokensOut: 80 },
      })),
    };

    const service = new RefinementSuggestionService(
      client as never,
      llmRouter as never,
    );

    const result = await service.getSuggestions({
      threadId: 'thread-1',
      userId: 'user-1',
      experienceVersionId: 'version-1',
    });

    expect(result).toHaveLength(4);
  });
});
