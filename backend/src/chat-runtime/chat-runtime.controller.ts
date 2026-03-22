import {
  Body,
  Controller,
  Get,
  Headers,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  parseListThreadsRequest,
  parseCreateThreadRequest,
  parseHydrateThreadRequest,
  parseStreamEventsRequestWithHeader,
  parseSubmitMessageRequest,
} from './dto/chat-runtime.dto';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';

@Controller('api/chat/threads')
@UseGuards(AuthGuard)
export class ChatRuntimeController {
  constructor(
    private readonly chatRuntimeService: ChatRuntimeService,
    private readonly chatRuntimeEvents: ChatRuntimeEventService,
  ) {}

  @Get()
  async listThreads(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
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
  async createThread(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
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
