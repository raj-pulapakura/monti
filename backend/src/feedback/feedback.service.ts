import { Injectable } from '@nestjs/common';
import type { ParsedFeedbackSubmit } from './feedback.dto';
import { FeedbackRepository } from './feedback.repository';

@Injectable()
export class FeedbackService {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

  async submit(input: { userId: string } & ParsedFeedbackSubmit): Promise<void> {
    await this.feedbackRepository.insert({
      user_id: input.userId,
      kind: input.kind,
      message: input.message,
      thread_id: input.threadId,
      message_id: input.messageId,
      experience_id: input.experienceId,
    });
  }
}
