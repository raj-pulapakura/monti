import { Injectable } from '@nestjs/common';
import { AppError, ValidationError } from '../../common/errors/app-error';
import type { CanonicalToolDefinition } from '../../llm/tool-runtime/tool-runtime.types';
import { GenerateExperienceToolService } from './generate-experience-tool.service';
import {
  parseGenerateExperienceToolArguments,
  type GenerateExperienceToolResult,
} from './generate-experience-tool.types';

const GENERATE_EXPERIENCE_TOOL_DEFINITION: CanonicalToolDefinition = {
  name: 'generate_experience',
  description:
    'Generate or refine an interactive learning experience in the sandbox. For new requests use operation=generate. Use operation=refine only when you have priorGenerationId, refinementInstruction, and full priorExperience.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['prompt'],
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'refine'],
        description:
          'Defaults to generate when omitted. Set to refine only for existing experiences.',
      },
      prompt: {
        type: 'string',
      },
      format: {
        type: 'string',
        enum: ['quiz', 'game', 'explainer'],
      },
      audience: {
        type: 'string',
        enum: ['young-kids', 'elementary', 'middle-school'],
      },
      refinementInstruction: {
        type: 'string',
        description: 'Required when operation=refine.',
      },
      priorGenerationId: {
        type: 'string',
        description: 'Required when operation=refine.',
      },
      priorExperience: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'html', 'css', 'js'],
        description: 'Required when operation=refine.',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          html: { type: 'string' },
          css: { type: 'string' },
          js: { type: 'string' },
        },
      },
    },
  },
};

export interface ChatToolExecutionResult {
  toolName: string;
  toolCallId: string;
  result: GenerateExperienceToolResult;
}

@Injectable()
export class ChatToolRegistryService {
  constructor(private readonly generateExperienceTool: GenerateExperienceToolService) {}

  getToolDefinitions(): CanonicalToolDefinition[] {
    if (!isGenerateExperienceToolEnabled()) {
      return [];
    }

    return [GENERATE_EXPERIENCE_TOOL_DEFINITION];
  }

  hasTool(name: string): boolean {
    return this.getToolDefinitions().some((tool) => tool.name === name);
  }

  async executeToolCall(input: {
    threadId: string;
    runId: string;
    userId: string;
    toolCallId: string;
    name: string;
    arguments: Record<string, unknown>;
    conversationContext?: string;
  }): Promise<ChatToolExecutionResult> {
    if (input.name !== 'generate_experience' || !isGenerateExperienceToolEnabled()) {
      throw new ValidationError(`Unknown or disabled tool: ${input.name}`);
    }

    let result: GenerateExperienceToolResult;
    try {
      const parsedArguments = parseGenerateExperienceToolArguments(input.arguments);
      result = await this.generateExperienceTool.execute({
        runId: input.runId,
        threadId: input.threadId,
        userId: input.userId,
        arguments: {
          ...parsedArguments,
          conversationContext: input.conversationContext,
        },
      });
    } catch (error) {
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

function isGenerateExperienceToolEnabled(): boolean {
  const flag = process.env.GENERATE_EXPERIENCE_TOOL_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
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
