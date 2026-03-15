import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ChatRuntimeModule } from './chat-runtime/chat-runtime.module';

@Module({
  imports: [ChatRuntimeModule],
  controllers: [AppController],
})
export class AppModule {}
