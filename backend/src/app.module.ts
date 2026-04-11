import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BillingModule } from './billing/billing.module';
import { AppController } from './app.controller';
import { chatRateLimitPerMinute } from './chat-runtime/chat-rate-limit.config';
import { ChatRuntimeModule } from './chat-runtime/chat-runtime.module';
import { FeedbackModule } from './feedback/feedback.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: chatRateLimitPerMinute(),
      },
    ]),
    ChatRuntimeModule,
    BillingModule,
    FeedbackModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
