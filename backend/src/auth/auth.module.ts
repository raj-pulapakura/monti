import { Module } from '@nestjs/common';
import { AuthConfigService } from './auth-config.service';
import { AuthGuard } from './auth.guard';
import { AuthJwtVerifierService } from './auth-jwt-verifier.service';

@Module({
  providers: [AuthConfigService, AuthJwtVerifierService, AuthGuard],
  exports: [AuthGuard, AuthJwtVerifierService],
})
export class AuthModule {}
