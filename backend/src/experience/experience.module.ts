import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { SafetyModule } from '../safety/safety.module';
import { ValidationModule } from '../validation/validation.module';
import { ExperienceOrchestratorService } from './services/experience-orchestrator.service';
import { PromptBuilderService } from './services/prompt-builder.service';

@Module({
  imports: [LlmModule, ValidationModule, SafetyModule, PersistenceModule],
  providers: [ExperienceOrchestratorService, PromptBuilderService],
  exports: [ExperienceOrchestratorService],
})
export class ExperienceModule {}
