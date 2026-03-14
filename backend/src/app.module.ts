import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ExperienceModule } from './experience/experience.module';

@Module({
  imports: [ExperienceModule],
  controllers: [AppController],
})
export class AppModule {}
