import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ChatRuntimeModule } from './chat-runtime/chat-runtime.module';
import { ExperienceModule } from './experience/experience.module';

@Module({
  imports: [ExperienceModule, ChatRuntimeModule],
  controllers: [AppController],
})
export class AppModule {}
