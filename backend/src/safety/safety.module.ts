import { Module } from '@nestjs/common';
import { SafetyGuardService } from './safety-guard.service';

@Module({
  providers: [SafetyGuardService],
  exports: [SafetyGuardService],
})
export class SafetyModule {}
