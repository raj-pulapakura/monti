import { ChatToolRegistryService } from './chat-tool-registry.service';
import type { ToolExecuteInput } from './chat-tool.interface';
import { parseGenerateExperienceToolArguments } from './generate-experience-tool.types';

describe('ChatToolRegistryService', () => {
  it('returns a failed tool result instead of throwing for invalid refine arguments', async () => {
    const generateTool = {
      name: 'generate_experience',
      definition: {
        name: 'generate_experience',
        description: 'generate',
        inputSchema: { type: 'object' },
      },
      requiresConfirmation: () => false,
      getConfirmationMetadata: () => ({
        operation: 'Refine experience',
        estimatedCredits: { fast: 1, quality: 5 },
      }),
      execute: jest.fn(async (input: ToolExecuteInput) => {
        parseGenerateExperienceToolArguments(input.arguments);
        return {
          status: 'succeeded' as const,
          generationId: 'gen-1',
          experienceId: null,
          experienceVersionId: null,
          errorCode: null,
          errorMessage: null,
          sandboxStatus: 'ready' as const,
          route: null,
        };
      }),
    };

    const service = new ChatToolRegistryService([generateTool as never]);

    const result = await service.executeToolCall({
      invocationId: 'invocation-1',
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
