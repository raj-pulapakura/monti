import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { SafetyModule } from '../safety/safety.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { ValidationModule } from '../validation/validation.module';
import { ExperiencePlayController } from './experience-play.controller';
import { ExperienceOrchestratorService } from './services/experience-orchestrator.service';
import { ExperiencePlayRepository } from './services/experience-play.repository';
import { PromptBuilderService } from './services/prompt-builder.service';

@Module({
  imports: [LlmModule, ValidationModule, SafetyModule, PersistenceModule, SupabaseModule],
  controllers: [ExperiencePlayController],
  providers: [ExperienceOrchestratorService, PromptBuilderService, ExperiencePlayRepository],
  exports: [ExperienceOrchestratorService],
})
export class ExperienceModule {}
