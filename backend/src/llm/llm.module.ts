import { Module } from '@nestjs/common';
import { LlmConfigService } from './llm-config.service';
import { LlmDecisionRouterService } from './llm-decision-router.service';
import { LlmRouterService } from './llm-router.service';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';
import { AnthropicNativeToolAdapter } from './tool-runtime/providers/anthropic-native-tool.adapter';
import { GeminiNativeToolAdapter } from './tool-runtime/providers/gemini-native-tool.adapter';
import { OpenAiNativeToolAdapter } from './tool-runtime/providers/openai-native-tool.adapter';
import { ToolLlmRouterService } from './tool-runtime/tool-llm-router.service';

@Module({
  providers: [
    LlmConfigService,
    OpenAiLlmProvider,
    AnthropicLlmProvider,
    GeminiLlmProvider,
    LlmRouterService,
    OpenAiNativeToolAdapter,
    AnthropicNativeToolAdapter,
    GeminiNativeToolAdapter,
    ToolLlmRouterService,
    LlmDecisionRouterService,
  ],
  exports: [LlmConfigService, LlmRouterService, ToolLlmRouterService, LlmDecisionRouterService],
})
export class LlmModule {}
