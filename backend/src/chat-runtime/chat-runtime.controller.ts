import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  MessageEvent,
  Patch,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { UserIdThrottlerGuard } from '../common/guards/user-id-throttler.guard';
import { chatRateLimitPerMinute } from './chat-rate-limit.config';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  parseListThreadsRequest,
  parseCreateThreadRequest,
  parseHydrateThreadRequest,
  parseRefinementSuggestionsRequest,
  parseStreamEventsRequestWithHeader,
  parseSubmitMessageRequest,
  parseVersionContentRequest,
  parseUpdateExperienceTitleRequest,
  parseToggleExperienceFavouriteRequest,
} from './dto/chat-runtime.dto';
import type { ThreadListPayload } from './dto/chat-runtime.dto';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';
import { RefinementSuggestionService } from './services/refinement-suggestion.service';
import type { RefinementSuggestion } from './services/refinement-suggestion.service';

@Controller('api/chat/threads')
@UseGuards(AuthGuard)
export class ChatRuntimeController {
  constructor(
    private readonly chatRuntimeService: ChatRuntimeService,
    private readonly chatRuntimeEvents: ChatRuntimeEventService,
    private readonly refinementSuggestions: RefinementSuggestionService,
  ) {}

  @Get()
  async listThreads(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: unknown,
  ): Promise<{
    ok: true;
    data: ThreadListPayload;
  }> {
    const request = parseListThreadsRequest(query);
    const payload = await this.chatRuntimeService.listThreads({
      request,
      userId: user.id,
    });

    return {
      ok: true,
      data: payload,
    };
  }

  @Post()
  async createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const request = parseCreateThreadRequest(body);
    const payload = await this.chatRuntimeService.createThread({
      request,
      userId: user.id,
    });

    return {
      ok: true,
      data: payload,
    };
  }

  @Get(':threadId')
  async hydrateThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Query() query: unknown,
  ) {
    const request = parseHydrateThreadRequest(threadId, query);
    const payload = await this.chatRuntimeService.hydrateThread({
      request,
      userId: user.id,
    });

    return {
      ok: true,
      data: payload,
    };
  }

  @Post(':threadId/messages')
  @UseGuards(UserIdThrottlerGuard)
  @Throttle({ default: { limit: chatRateLimitPerMinute(), ttl: 60_000 } })
  async submitMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ) {
    const request = parseSubmitMessageRequest(threadId, body);
    const payload = await this.chatRuntimeService.submitMessage({
      threadId: request.threadId,
      request: request.request,
      userId: user.id,
    });

    return {
      ok: true,
      data: payload,
    };
  }

  @Get(':threadId/refinement-suggestions')
  async getRefinementSuggestions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Query() query: unknown,
  ): Promise<{ ok: true; data: { suggestions: RefinementSuggestion[] } }> {
    const request = parseRefinementSuggestionsRequest(threadId, query);
    const suggestions = await this.refinementSuggestions.getSuggestions({
      threadId: request.threadId,
      userId: user.id,
      experienceVersionId: request.experienceVersionId,
    });

    return {
      ok: true,
      data: { suggestions },
    };
  }

  @Get(':threadId/experience-versions/:versionId')
  async getVersionContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Param('versionId') versionId: string,
  ) {
    const request = parseVersionContentRequest(threadId, versionId);
    const content = await this.chatRuntimeService.getVersionContent({
      threadId: request.threadId,
      userId: user.id,
      versionId: request.versionId,
    });

    return {
      ok: true,
      data: content,
    };
  }

  @Get(':threadId/sandbox')
  async getSandboxPreview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Query() query: unknown,
  ) {
    const request = parseHydrateThreadRequest(threadId, query);
    const payload = await this.chatRuntimeService.getSandboxPreview({
      threadId: request.threadId,
      userId: user.id,
    });

    return {
      ok: true,
      data: payload,
    };
  }

  @Patch(':threadId/title')
  async updateExperienceTitle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ): Promise<{ ok: true; data: { title: string } }> {
    const request = parseHydrateThreadRequest(threadId, {});
    const parsed = parseUpdateExperienceTitleRequest(body);
    const result = await this.chatRuntimeService.updateExperienceTitle({
      threadId: request.threadId,
      userId: user.id,
      title: parsed.title,
    });

    return {
      ok: true,
      data: {
        title: result.title,
      },
    };
  }

  @Patch(':threadId/favourite')
  async updateExperienceFavourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ): Promise<{ ok: true; data: { isFavourite: boolean } }> {
    const request = parseHydrateThreadRequest(threadId, {});
    const parsed = parseToggleExperienceFavouriteRequest(body);
    const result = await this.chatRuntimeService.toggleExperienceFavourite({
      threadId: request.threadId,
      userId: user.id,
      isFavourite: parsed.isFavourite,
    });

    return {
      ok: true,
      data: {
        isFavourite: result.isFavourite,
      },
    };
  }

  @Delete(':threadId')
  async deleteThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
  ): Promise<{ ok: true }> {
    const request = parseHydrateThreadRequest(threadId, {});
    await this.chatRuntimeService.deleteThread({
      threadId: request.threadId,
      userId: user.id,
    });

    return { ok: true };
  }

  @Sse(':threadId/events')
  async streamEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param('threadId') threadId: string,
    @Query() query: unknown,
    @Headers('last-event-id') lastEventIdHeader?: string,
  ): Promise<Observable<MessageEvent>> {
    const request = parseStreamEventsRequestWithHeader(
      threadId,
      query,
      lastEventIdHeader,
    );
    await this.chatRuntimeService.assertThreadAccess({
      threadId: request.threadId,
      userId: user.id,
    });
    return this.chatRuntimeEvents.stream(request.threadId, request.cursor);
  }
}
