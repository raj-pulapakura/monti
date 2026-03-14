import { Module } from '@nestjs/common';
import { LlmConfigService } from './llm-config.service';
import { LlmRouterService } from './llm-router.service';
import { AnthropicLlmProvider } from './providers/anthropic-llm.provider';
import { GeminiLlmProvider } from './providers/gemini-llm.provider';
import { OpenAiLlmProvider } from './providers/openai-llm.provider';

@Module({
  providers: [
    LlmConfigService,
    OpenAiLlmProvider,
    AnthropicLlmProvider,
    GeminiLlmProvider,
    LlmRouterService,
  ],
  exports: [LlmConfigService, LlmRouterService],
})
export class LlmModule {}
