import { ValidationError } from '../../common/errors/app-error';
import { ChatRuntimeRepository } from './chat-runtime.repository';

describe('ChatRuntimeRepository', () => {
  function createClientForThreadLookup(options: {
    thread: Record<string, unknown> | null;
  }) {
    const eqCalls: Array<{ column: string; value: unknown }> = [];

    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((column: string, value: unknown) => {
        eqCalls.push({ column, value });
        return query;
      }),
      maybeSingle: jest.fn(async () => ({
        data: options.thread,
        error: null,
      })),
    };

    const client = {
      from: jest.fn(() => query),
    };

    return {
      client,
      query,
      eqCalls,
    };
  }

  it('allows thread access for the owner user scope', async () => {
    const mock = createClientForThreadLookup({
      thread: {
        id: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        user_id: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      },
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.assertThreadAccess({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: 'd4197995-f1cf-4d06-8fdf-28d625087445',
      }),
    ).resolves.toBeUndefined();

    expect(mock.query.select).toHaveBeenCalledWith('*');
    expect(mock.eqCalls).toEqual([
      { column: 'id', value: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95' },
      { column: 'user_id', value: 'd4197995-f1cf-4d06-8fdf-28d625087445' },
    ]);
  });

  it('rejects thread access when the thread is not owned by the caller', async () => {
    const mock = createClientForThreadLookup({
      thread: null,
    });
    const repository = new ChatRuntimeRepository(mock.client as never);

    await expect(
      repository.assertThreadAccess({
        threadId: '0b2ec6af-2775-42d0-b0f8-e8d6f4ea3f95',
        userId: '34fda4d9-6629-43ff-b92a-2550f0d39774',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
