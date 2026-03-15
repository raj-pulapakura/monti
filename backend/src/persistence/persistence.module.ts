import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ExperiencePersistenceRepository } from './services/experience-persistence.repository';
import { ExperiencePersistenceService } from './services/experience-persistence.service';

@Module({
  imports: [SupabaseModule],
  providers: [ExperiencePersistenceRepository, ExperiencePersistenceService],
  exports: [ExperiencePersistenceService],
})
export class PersistenceModule {}
