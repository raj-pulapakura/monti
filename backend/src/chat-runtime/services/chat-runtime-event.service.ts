import { Injectable, MessageEvent } from '@nestjs/common';
import { concat, from, map, Observable, Subject } from 'rxjs';
import type { RuntimeEventType } from '../runtime.enums';

interface RuntimeEventRecord {
  id: string;
  threadId: string;
  runId: string | null;
  type: RuntimeEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

@Injectable()
export class ChatRuntimeEventService {
  private readonly maxEventsPerThread = 5000;
  private readonly transientHydrationEventTypes = new Set<RuntimeEventType>([
    'assistant_message_started',
    'assistant_message_updated',
  ]);
  private readonly eventsByThread = new Map<string, RuntimeEventRecord[]>();
  private readonly streamByThread = new Map<string, Subject<RuntimeEventRecord>>();
  private nextId = 1;

  publish(input: {
    threadId: string;
    runId?: string | null;
    type: RuntimeEventType;
    payload: Record<string, unknown>;
  }): RuntimeEventRecord {
    const event: RuntimeEventRecord = {
      id: String(this.nextId++),
      threadId: input.threadId,
      runId: input.runId ?? null,
      type: input.type,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };

    const list = this.eventsByThread.get(input.threadId) ?? [];
    list.push(event);
    if (list.length > this.maxEventsPerThread) {
      list.splice(0, list.length - this.maxEventsPerThread);
    }
    this.eventsByThread.set(input.threadId, list);

    this.subjectFor(input.threadId).next(event);

    return event;
  }

  stream(threadId: string, cursor?: string | undefined): Observable<MessageEvent> {
    const replay = this.eventsSince(threadId, cursor);
    const subject = this.subjectFor(threadId);

    return concat(
      from(replay).pipe(map((event) => toMessageEvent(event))),
      subject.asObservable().pipe(map((event) => toMessageEvent(event))),
    );
  }

  latestEventId(threadId: string): string | null {
    const list = this.eventsByThread.get(threadId);
    if (!list || list.length === 0) {
      return null;
    }

    return list[list.length - 1].id;
  }

  latestHydrationCursor(threadId: string): string | null {
    const list = this.eventsByThread.get(threadId) ?? [];
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const event = list[index];
      if (!this.transientHydrationEventTypes.has(event.type)) {
        return event.id;
      }
    }

    return null;
  }

  private eventsSince(threadId: string, cursor?: string): RuntimeEventRecord[] {
    const list = this.eventsByThread.get(threadId) ?? [];
    const cursorValue = toNumericCursor(cursor);

    return list.filter((event) => Number(event.id) > cursorValue);
  }

  private subjectFor(threadId: string): Subject<RuntimeEventRecord> {
    const existing = this.streamByThread.get(threadId);
    if (existing) {
      return existing;
    }

    const created = new Subject<RuntimeEventRecord>();
    this.streamByThread.set(threadId, created);
    return created;
  }
}

function toMessageEvent(event: RuntimeEventRecord): MessageEvent {
  return {
    id: event.id,
    type: event.type,
    data: {
      threadId: event.threadId,
      runId: event.runId,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt,
    },
  };
}

function toNumericCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}
