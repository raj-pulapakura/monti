import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { UserProfileController } from './user-profile.controller';
import { UserProfileRepository } from './user-profile.repository';
import { UserProfileService } from './user-profile.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [UserProfileController],
  providers: [UserProfileRepository, UserProfileService],
  exports: [UserProfileService],
})
export class UserProfileModule {}
