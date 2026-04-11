import { Module } from '@nestjs/common';
import { BillingModule } from './billing/billing.module';
import { AppController } from './app.controller';
import { ChatRuntimeModule } from './chat-runtime/chat-runtime.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [ChatRuntimeModule, BillingModule, FeedbackModule],
  controllers: [AppController],
})
export class AppModule {}
