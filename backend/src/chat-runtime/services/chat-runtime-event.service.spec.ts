import { firstValueFrom, take, toArray } from 'rxjs';
import { ChatRuntimeEventService } from './chat-runtime-event.service';

describe('ChatRuntimeEventService', () => {
  it('replays events after cursor for reconnect-safe consumption', async () => {
    const service = new ChatRuntimeEventService();

    service.publish({
      threadId: 'thread-1',
      runId: 'run-1',
      type: 'run_started',
      payload: {},
    });
    service.publish({
      threadId: 'thread-1',
      runId: 'run-1',
      type: 'tool_started',
      payload: {},
    });
    service.publish({
      threadId: 'thread-1',
      runId: 'run-1',
      type: 'run_completed',
      payload: {},
    });

    const replayEvents = await firstValueFrom(
      service.stream('thread-1', '1').pipe(take(2), toArray()),
    );

    expect(replayEvents).toHaveLength(2);
    expect(replayEvents[0].id).toBe('2');
    expect(replayEvents[1].id).toBe('3');
  });

  it('publishes new live events to existing stream subscribers', async () => {
    const service = new ChatRuntimeEventService();

    const nextEventPromise = firstValueFrom(service.stream('thread-2').pipe(take(1)));

    service.publish({
      threadId: 'thread-2',
      runId: 'run-2',
      type: 'run_started',
      payload: { step: 'start' },
    });

    const nextEvent = await nextEventPromise;
    expect(nextEvent.type).toBe('run_started');
    expect(nextEvent.id).toBe('1');
  });

  it('excludes transient assistant draft events from hydration cursors', () => {
    const service = new ChatRuntimeEventService();

    service.publish({
      threadId: 'thread-3',
      runId: 'run-3',
      type: 'run_started',
      payload: {},
    });
    service.publish({
      threadId: 'thread-3',
      runId: 'run-3',
      type: 'assistant_message_started',
      payload: { draftId: 'run-3', content: 'Hi' },
    });
    const persistedEvent = service.publish({
      threadId: 'thread-3',
      runId: 'run-3',
      type: 'assistant_message_created',
      payload: { messageId: 'assistant-1' },
    });
    service.publish({
      threadId: 'thread-3',
      runId: 'run-3',
      type: 'assistant_message_updated',
      payload: { draftId: 'run-3', content: 'Hi again' },
    });

    expect(service.latestEventId('thread-3')).toBe('4');
    expect(service.latestHydrationCursor('thread-3')).toBe(persistedEvent.id);
  });
});
