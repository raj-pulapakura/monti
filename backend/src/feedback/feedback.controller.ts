import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { parseFeedbackRequest } from './feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('api/feedback')
@UseGuards(AuthGuard)
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  async post(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = parseFeedbackRequest(body);
    await this.feedbackService.submit({
      userId: user.id,
      ...parsed,
    });
    return { ok: true };
  }
}
