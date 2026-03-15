import { Module } from '@nestjs/common';
import { ExperienceModule } from '../experience/experience.module';
import { LlmModule } from '../llm/llm.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatRuntimeController } from './chat-runtime.controller';
import { ConversationLoopService } from './services/conversation-loop.service';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';
import { ChatRuntimeRepository } from './services/chat-runtime.repository';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { ChatToolRegistryService } from './tools/chat-tool-registry.service';
import { GenerateExperienceToolService } from './tools/generate-experience-tool.service';

@Module({
  imports: [SupabaseModule, LlmModule, ExperienceModule],
  controllers: [ChatRuntimeController],
  providers: [
    ChatRuntimeRepository,
    ChatRuntimeService,
    ConversationLoopService,
    ChatRuntimeEventService,
    ChatToolRegistryService,
    GenerateExperienceToolService,
  ],
  exports: [ChatRuntimeService],
})
export class ChatRuntimeModule {}
