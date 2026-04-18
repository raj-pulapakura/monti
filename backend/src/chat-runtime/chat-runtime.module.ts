import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ExperienceModule } from '../experience/experience.module';
import { LlmModule } from '../llm/llm.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { UserProfileModule } from '../user-profile/user-profile.module';
import { UserIdThrottlerGuard } from '../common/guards/user-id-throttler.guard';
import { ChatRuntimeController } from './chat-runtime.controller';
import { ConversationLoopService } from './services/conversation-loop.service';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';
import { ChatRuntimeRepository } from './services/chat-runtime.repository';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { RefinementSuggestionService } from './services/refinement-suggestion.service';
import { ChatToolRegistryService } from './tools/chat-tool-registry.service';
import { GenerateExperienceChatTool } from './tools/generate-experience.chat-tool';
import { GenerateExperienceToolService } from './tools/generate-experience-tool.service';

@Module({
  imports: [
    AuthModule,
    SupabaseModule,
    LlmModule,
    ExperienceModule,
    BillingModule,
    UserProfileModule,
  ],
  controllers: [ChatRuntimeController],
  providers: [
    ChatRuntimeRepository,
    ChatRuntimeService,
    ConversationLoopService,
    ChatRuntimeEventService,
    RefinementSuggestionService,
    GenerateExperienceChatTool,
    {
      provide: ChatToolRegistryService,
      useFactory: (generateExperienceChatTool: GenerateExperienceChatTool) =>
        new ChatToolRegistryService([generateExperienceChatTool]),
      inject: [GenerateExperienceChatTool],
    },
    GenerateExperienceToolService,
    UserIdThrottlerGuard,
  ],
  exports: [ChatRuntimeService],
})
export class ChatRuntimeModule {}
