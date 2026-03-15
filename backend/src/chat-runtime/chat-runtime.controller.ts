import { Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import type { Observable } from 'rxjs';
import {
  parseCreateThreadRequest,
  parseHydrateThreadRequest,
  parseStreamEventsRequest,
  parseSubmitMessageRequest,
} from './dto/chat-runtime.dto';
import { ChatRuntimeService } from './services/chat-runtime.service';
import { ChatRuntimeEventService } from './services/chat-runtime-event.service';

@Controller('api/chat/threads')
export class ChatRuntimeController {
  constructor(
    private readonly chatRuntimeService: ChatRuntimeService,
    private readonly chatRuntimeEvents: ChatRuntimeEventService,
  ) {}

  @Post()
  async createThread(@Body() body: unknown) {
    const request = parseCreateThreadRequest(body);
    const payload = await this.chatRuntimeService.createThread(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Get(':threadId')
  async hydrateThread(@Param('threadId') threadId: string, @Query() query: unknown) {
    const request = parseHydrateThreadRequest(threadId, query);
    const payload = await this.chatRuntimeService.hydrateThread(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Post(':threadId/messages')
  async submitMessage(@Param('threadId') threadId: string, @Body() body: unknown) {
    const request = parseSubmitMessageRequest(threadId, body);
    const payload = await this.chatRuntimeService.submitMessage(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Get(':threadId/sandbox')
  async getSandboxPreview(@Param('threadId') threadId: string, @Query() query: unknown) {
    const request = parseHydrateThreadRequest(threadId, query);
    const payload = await this.chatRuntimeService.getSandboxPreview(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Sse(':threadId/events')
  streamEvents(
    @Param('threadId') threadId: string,
    @Query() query: unknown,
  ): Observable<MessageEvent> {
    const request = parseStreamEventsRequest(threadId, query);
    return this.chatRuntimeEvents.stream(request.threadId, request.cursor);
  }
}
