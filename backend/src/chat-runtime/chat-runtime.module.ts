import { Module } from '@nestjs/common';
import { ExperienceModule } from '../experience/experience.module';
import { LlmModule } from '../llm/llm.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ChatRuntimeController } from './chat-runtime.controller';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';
import { ChatRuntimeRepository } from './services/chat-runtime.repository';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { ChatToolRegistryService } from './tools/chat-tool-registry.service';

@Module({
  imports: [SupabaseModule, LlmModule, ExperienceModule],
  controllers: [ChatRuntimeController],
  providers: [
    ChatRuntimeRepository,
    ChatRuntimeService,
    ChatRuntimeEventService,
    ChatToolRegistryService,
  ],
  exports: [ChatRuntimeService],
})
export class ChatRuntimeModule {}
