import { Injectable } from '@nestjs/common';
import { AppError, ValidationError } from '../../common/errors/app-error';
import type { QualityMode } from '../../llm/llm.types';
import { isGenerateExperienceToolEnabled } from './generate-experience.chat-tool';
import type { ChatTool } from './chat-tool.interface';
import type { GenerateExperienceToolResult } from './generate-experience-tool.types';

export interface ChatToolExecutionResult {
  toolName: string;
  toolCallId: string;
  result: GenerateExperienceToolResult;
}

@Injectable()
export class ChatToolRegistryService {
  constructor(private readonly tools: ChatTool<unknown>[]) {}

  private get registeredTools(): ChatTool<unknown>[] {
    return this.tools.filter((tool) => {
      if (tool.name === 'generate_experience' && !isGenerateExperienceToolEnabled()) {
        return false;
      }
      return true;
    });
  }

  getToolDefinitions() {
    return this.registeredTools.map((tool) => tool.definition);
  }

  hasTool(name: string): boolean {
    return this.registeredTools.some((tool) => tool.name === name);
  }

  getTool(name: string): ChatTool<unknown> | undefined {
    return this.registeredTools.find((tool) => tool.name === name);
  }

  async executeToolCall(input: {
    invocationId: string;
    threadId: string;
    runId: string;
    userId: string;
    toolCallId: string;
    name: string;
    arguments: Record<string, unknown>;
    conversationContext?: string;
    requestedQualityMode?: QualityMode;
    signal?: AbortSignal;
  }): Promise<ChatToolExecutionResult> {
    const tool = this.getTool(input.name);
    if (!tool) {
      throw new ValidationError(`Unknown or disabled tool: ${input.name}`);
    }

    let result: GenerateExperienceToolResult;
    try {
      result = (await tool.execute({
        invocationId: input.invocationId,
        threadId: input.threadId,
        runId: input.runId,
        userId: input.userId,
        toolCallId: input.toolCallId,
        name: input.name,
        arguments: input.arguments,
        conversationContext: input.conversationContext,
        requestedQualityMode: input.requestedQualityMode,
        signal: input.signal,
      })) as GenerateExperienceToolResult;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      result = {
        status: 'failed',
        generationId: null,
        experienceId: null,
        experienceVersionId: null,
        errorCode: toErrorCode(error),
        errorMessage: toErrorMessage(error),
        sandboxStatus: 'error',
        route: null,
      };
    }

    return {
      toolName: input.name,
      toolCallId: input.toolCallId,
      result,
    };
  }
}

function toErrorCode(error: unknown): string {
  if (error instanceof AppError) {
    return error.code;
  }

  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }

  return 'UNKNOWN_ERROR';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Tool arguments were invalid.';
}
