import { Injectable } from '@nestjs/common';
import { BillingConfigService } from '../../billing/billing-config.service';
import type { CanonicalToolDefinition } from '../../llm/tool-runtime/tool-runtime.types';
import type { ChatTool, ToolConfirmationMetadata, ToolExecuteInput } from './chat-tool.interface';
import { GenerateExperienceToolService } from './generate-experience-tool.service';
import {
  parseGenerateExperienceToolArguments,
  type GenerateExperienceToolResult,
} from './generate-experience-tool.types';

const GENERATE_EXPERIENCE_TOOL_DEFINITION: CanonicalToolDefinition = {
  name: 'generate_experience',
  description:
    'Generate or refine an interactive learning experience in the sandbox. Use operation=generate for new experiences. Use operation=refine when the user wants to modify or improve the current experience — the system automatically uses the active experience as the starting point.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['prompt'],
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'refine'],
        description:
          'Use generate for new experiences. Use refine when modifying the current experience in the sandbox.',
      },
      prompt: {
        type: 'string',
      },
      refinementInstruction: {
        type: 'string',
        description: 'Required when operation=refine. Describe what to change.',
      },
    },
  },
};

export function isGenerateExperienceToolEnabled(): boolean {
  const flag = process.env.GENERATE_EXPERIENCE_TOOL_ENABLED?.trim().toLowerCase();
  return !(flag === 'false' || flag === '0' || flag === 'off');
}

@Injectable()
export class GenerateExperienceChatTool implements ChatTool<GenerateExperienceToolResult> {
  readonly name = 'generate_experience';
  readonly definition = GENERATE_EXPERIENCE_TOOL_DEFINITION;

  constructor(
    private readonly generateExperienceTool: GenerateExperienceToolService,
    private readonly billingConfig: BillingConfigService,
  ) {}

  requiresConfirmation(_args: Record<string, unknown>): boolean {
    return true;
  }

  getConfirmationMetadata(args: Record<string, unknown>): ToolConfirmationMetadata {
    let operationKey: 'generate' | 'refine' = 'generate';
    try {
      const parsed = parseGenerateExperienceToolArguments(args);
      operationKey = parsed.operation;
    } catch {
      operationKey = args.operation === 'refine' ? 'refine' : 'generate';
    }

    const operation =
      operationKey === 'refine' ? 'Refine experience' : 'Generate experience';

    return {
      operation,
      estimatedCredits: {
        fast: this.billingConfig.launchCatalog.fastCredits,
        quality: this.billingConfig.launchCatalog.qualityCredits,
      },
    };
  }

  async execute(input: ToolExecuteInput): Promise<GenerateExperienceToolResult> {
    const parsedArguments = parseGenerateExperienceToolArguments(input.arguments);
    return this.generateExperienceTool.execute({
      invocationId: input.invocationId,
      runId: input.runId,
      threadId: input.threadId,
      userId: input.userId,
      arguments: {
        ...parsedArguments,
        conversationContext: input.conversationContext,
      },
      requestedQualityMode: input.requestedQualityMode,
      signal: input.signal,
    });
  }
}
