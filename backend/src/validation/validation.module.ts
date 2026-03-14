import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { PayloadValidationService } from './payload-validation.service';

@Module({
  imports: [LlmModule],
  providers: [PayloadValidationService],
  exports: [PayloadValidationService],
})
export class ValidationModule {}
