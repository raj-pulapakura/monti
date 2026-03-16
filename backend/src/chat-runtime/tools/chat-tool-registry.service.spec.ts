import { ChatToolRegistryService } from './chat-tool-registry.service';

describe('ChatToolRegistryService', () => {
  it('returns a failed tool result instead of throwing for invalid refine arguments', async () => {
    const service = new ChatToolRegistryService({
      execute: jest.fn(async () => {
        throw new Error('should not execute');
      }),
    } as never);

    const result = await service.executeToolCall({
      threadId: 'thread-1',
      runId: 'run-1',
      userId: 'client-1',
      toolCallId: 'call-1',
      name: 'generate_experience',
      arguments: {
        operation: 'refine',
        prompt: 'Refine this',
      },
    });

    expect(result.result.status).toBe('failed');
    expect(result.result.errorCode).toBe('VALIDATION_ERROR');
    expect(result.result.errorMessage).toContain('refinementInstruction');
  });
});
