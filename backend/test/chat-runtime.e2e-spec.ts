import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { firstValueFrom, take, timeout } from 'rxjs';
import { AppModule } from './../src/app.module';
import { AuthJwtVerifierService } from './../src/auth/auth-jwt-verifier.service';
import type { AuthenticatedUser } from './../src/auth/auth.types';
import { AuthenticationError, ValidationError } from './../src/common/errors/app-error';
import { ChatRuntimeEventService } from './../src/chat-runtime/services/chat-runtime-event.service';
import { ChatRuntimeRepository } from './../src/chat-runtime/services/chat-runtime.repository';
import { SUPABASE_CLIENT } from './../src/supabase/supabase.constants';

const USER_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_A_TOKEN = 'token-user-a';
const USER_B_TOKEN = 'token-user-b';

type ThreadRow = {
  id: string;
  user_id: string;
  title: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  content_json: Record<string, unknown> | null;
  idempotency_key: string | null;
  created_at: string;
};

type RunRow = {
  id: string;
  thread_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  router_tier: 'fast' | 'quality' | null;
  router_provider_hint: 'openai' | 'anthropic' | 'gemini' | null;
  router_confidence: number | null;
  router_reason: string | null;
  router_fallback_reason: string | null;
  conversation_provider: 'openai' | 'anthropic' | 'gemini' | null;
  conversation_model: string | null;
  provider: 'openai' | 'anthropic' | 'gemini' | null;
  model: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type SandboxStateRow = {
  thread_id: string;
  status: 'empty' | 'creating' | 'ready' | 'error';
  experience_id: string | null;
  experience_version_id: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  updated_at: string;
};

class InMemoryChatRuntimeRepository {
  private readonly threads = new Map<string, ThreadRow>();
  private readonly messages: MessageRow[] = [];
  private readonly runs = new Map<string, RunRow>();
  private readonly sandboxStates = new Map<string, SandboxStateRow>();
  private readonly idempotency = new Map<string, { messageId: string; runId: string }>();
  private readonly favouriteByThread = new Map<string, boolean>();

  async createThread(input: {
    userId: string;
    title?: string;
  }): Promise<{
    thread: ThreadRow;
    sandboxState: SandboxStateRow;
  }> {
    const now = new Date().toISOString();
    const thread: ThreadRow = {
      id: randomUUID(),
      user_id: input.userId,
      title: input.title ?? null,
      archived_at: null,
      created_at: now,
      updated_at: now,
    };

    const sandboxState: SandboxStateRow = {
      thread_id: thread.id,
      status: 'empty',
      experience_id: null,
      experience_version_id: null,
      last_error_code: null,
      last_error_message: null,
      updated_at: now,
    };

    this.threads.set(thread.id, thread);
    this.sandboxStates.set(thread.id, sandboxState);

    return {
      thread,
      sandboxState,
    };
  }

  async listThreads(input: {
    userId: string;
    limit: number;
  }): Promise<
    Array<
      ThreadRow & {
        sandbox_status: 'empty' | 'creating' | 'ready' | 'error' | null;
        sandbox_updated_at: string | null;
        experience_html: string | null;
        experience_css: string | null;
        experience_js: string | null;
        experience_title: string | null;
        experience_is_favourite: boolean;
      }
    >
  > {
    return [...this.threads.values()]
      .filter((thread) => thread.user_id === input.userId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, input.limit)
      .map((thread) => {
        const sandbox = this.sandboxStates.get(thread.id);
        return {
          ...thread,
          sandbox_status: sandbox?.status ?? null,
          sandbox_updated_at: sandbox?.updated_at ?? null,
          experience_html: null,
          experience_css: null,
          experience_js: null,
          experience_title: null,
          experience_is_favourite: this.favouriteByThread.get(thread.id) ?? false,
        };
      });
  }

  async toggleFavourite(input: {
    threadId: string;
    userId: string;
    isFavourite: boolean;
  }): Promise<{ isFavourite: boolean }> {
    this.findScopedThread(input.threadId, input.userId);
    const sandbox = this.sandboxStates.get(input.threadId);
    if (!sandbox?.experience_id) {
      throw new ValidationError('No active experience for this thread.');
    }

    this.favouriteByThread.set(input.threadId, input.isFavourite);
    return { isFavourite: input.isFavourite };
  }

  async hydrateThread(input: {
    threadId: string;
    userId: string;
  }): Promise<{
    thread: ThreadRow;
    messages: MessageRow[];
    sandboxState: SandboxStateRow;
    activeRun: RunRow | null;
    activeToolInvocation: null;
  }> {
    const thread = this.findScopedThread(input.threadId, input.userId);

    const messages = this.messages
      .filter((message) => message.thread_id === input.threadId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    const sandboxState = this.sandboxStates.get(input.threadId);
    if (!sandboxState) {
      throw new ValidationError('Sandbox state is missing for thread.');
    }

    const activeRun = [...this.runs.values()]
      .filter(
        (run) =>
          run.thread_id === input.threadId &&
          (run.status === 'queued' || run.status === 'running'),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;

    return {
      thread,
      messages,
      sandboxState,
      activeRun,
      activeToolInvocation: null,
    };
  }

  async submitUserMessage(input: {
    threadId: string;
    content: string;
    idempotencyKey?: string;
  }): Promise<{
    message: MessageRow;
    run: RunRow | null;
    deduplicated: boolean;
  }> {
    const thread = this.findThread(input.threadId);
    const normalizedKey = input.idempotencyKey?.trim() || null;
    const dedupKey = normalizedKey ? `${input.threadId}:${normalizedKey}` : null;

    if (dedupKey) {
      const existing = this.idempotency.get(dedupKey);
      if (existing) {
        const message = this.messages.find((row) => row.id === existing.messageId);
        const run = this.runs.get(existing.runId) ?? null;
        if (!message) {
          throw new ValidationError('Submitted message was not found.');
        }

        return {
          message,
          run,
          deduplicated: true,
        };
      }
    }

    const now = new Date().toISOString();
    const message: MessageRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      user_id: thread.user_id,
      role: 'user',
      content: input.content,
      content_json: null,
      idempotency_key: normalizedKey,
      created_at: now,
    };

    const run: RunRow = {
      id: randomUUID(),
      thread_id: input.threadId,
      user_message_id: message.id,
      assistant_message_id: null,
      status: 'queued',
      router_tier: null,
      router_provider_hint: null,
      router_confidence: null,
      router_reason: null,
      router_fallback_reason: null,
      conversation_provider: null,
      conversation_model: null,
      provider: null,
      model: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
      created_at: now,
    };

    this.messages.push(message);
    this.runs.set(run.id, run);
    if (!thread.title || thread.title.trim().length === 0) {
      thread.title = buildThreadTitleSnippet(message.content);
    }
    thread.updated_at = now;
    this.threads.set(thread.id, thread);
    if (dedupKey) {
      this.idempotency.set(dedupKey, {
        messageId: message.id,
        runId: run.id,
      });
    }

    return {
      message,
      run,
      deduplicated: false,
    };
  }

  async findUserMessageByIdempotencyKey(input: {
    threadId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<MessageRow | null> {
    const key = input.idempotencyKey.trim();
    if (!key) {
      return null;
    }
    const matches = this.messages.filter(
      (m) =>
        m.thread_id === input.threadId &&
        m.user_id === input.userId &&
        m.role === 'user' &&
        m.idempotency_key === key,
    );
    matches.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return matches[0] ?? null;
  }

  async findLatestRunForUserMessage(userMessageId: string): Promise<RunRow | null> {
    const matches = [...this.runs.values()].filter((r) => r.user_message_id === userMessageId);
    matches.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return matches[0] ?? null;
  }

  async seedThreadTitleIfEmpty(input: { threadId: string; content: string }): Promise<void> {
    const thread = this.findThread(input.threadId);
    if (!thread.title || thread.title.trim().length === 0) {
      thread.title = buildThreadTitleSnippet(input.content);
      thread.updated_at = new Date().toISOString();
      this.threads.set(thread.id, thread);
    }
  }

  async updateMessageContentJson(input: {
    messageId: string;
    contentJson: Record<string, unknown> | null;
  }): Promise<MessageRow> {
    const messageIndex = this.messages.findIndex((message) => message.id === input.messageId);
    if (messageIndex === -1) {
      throw new ValidationError('Submitted message was not found.');
    }

    const updatedMessage: MessageRow = {
      ...this.messages[messageIndex],
      content_json: input.contentJson,
    };
    this.messages[messageIndex] = updatedMessage;
    return updatedMessage;
  }

  async assertThreadAccess(input: {
    threadId: string;
    userId: string;
  }): Promise<void> {
    this.findScopedThread(input.threadId, input.userId);
  }

  async getSandboxPreview(input: {
    threadId: string;
    userId: string;
  }): Promise<{
    sandboxState: SandboxStateRow;
    activeExperience: null;
  }> {
    this.findScopedThread(input.threadId, input.userId);

    const sandboxState = this.sandboxStates.get(input.threadId);
    if (!sandboxState) {
      throw new ValidationError('Sandbox state is missing for thread.');
    }

    return {
      sandboxState,
      activeExperience: null,
    };
  }

  async recordRunProviderTrace(): Promise<void> {
    return;
  }

  private findThread(threadId: string): ThreadRow {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new ValidationError('Thread not found for user scope.');
    }

    return thread;
  }

  private findScopedThread(threadId: string, userId: string): ThreadRow {
    const thread = this.findThread(threadId);
    if (thread.user_id !== userId) {
      throw new ValidationError('Thread not found for user scope.');
    }

    return thread;
  }
}

describe('Chat Runtime (e2e)', () => {
  let app: INestApplication;
  let chatRuntimeEvents: ChatRuntimeEventService;

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.CHAT_RUNTIME_ENABLED = 'true';
    process.env.CONVERSATION_LOOP_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ChatRuntimeRepository)
      .useValue(new InMemoryChatRuntimeRepository())
      .overrideProvider(SUPABASE_CLIENT)
      .useValue({})
      .overrideProvider(AuthJwtVerifierService)
      .useValue({
        verifyAccessToken: async (token: string): Promise<AuthenticatedUser> => {
          if (token === USER_A_TOKEN) {
            return createAuthUser(USER_A_ID, USER_A_TOKEN);
          }

          if (token === USER_B_TOKEN) {
            return createAuthUser(USER_B_ID, USER_B_TOKEN);
          }

          throw new AuthenticationError('Invalid or expired access token.');
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    chatRuntimeEvents = moduleFixture.get<ChatRuntimeEventService>(ChatRuntimeEventService);
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.CHAT_RUNTIME_ENABLED;
    delete process.env.CONVERSATION_LOOP_ENABLED;
  });

  it('enforces authenticated idempotent message submission and thread scoping', async () => {
    const createThreadResponse = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Auth scoped thread' })
      .expect(201);

    const threadId = createThreadResponse.body.data.thread.id as string;
    const idempotencyKey = randomUUID();

    const firstSubmit = await request(app.getHttpServer())
      .post(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'Build a solar-system quiz',
        idempotencyKey,
      })
      .expect(201);
    const secondSubmit = await request(app.getHttpServer())
      .post(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'Build a solar-system quiz',
        idempotencyKey,
      })
      .expect(201);

    expect(firstSubmit.body.data.deduplicated).toBe(false);
    expect(secondSubmit.body.data.deduplicated).toBe(true);
    expect(secondSubmit.body.data.message.id).toBe(firstSubmit.body.data.message.id);
    expect(secondSubmit.body.data.run.id).toBe(firstSubmit.body.data.run.id);

    const ownerHydration = await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);
    expect(ownerHydration.body.data.thread.userId).toBe(USER_A_ID);
    expect(ownerHydration.body.data.messages).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}`)
      .set('Authorization', `Bearer ${USER_B_TOKEN}`)
      .expect(400);

    await request(app.getHttpServer()).get(`/api/chat/threads/${threadId}`).expect(401);
  });

  it('accepts explicit generation mode metadata on submitted messages', async () => {
    const createThreadResponse = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Routing preference thread' })
      .expect(201);

    const threadId = createThreadResponse.body.data.thread.id as string;

    const submitResponse = await request(app.getHttpServer())
      .post(`/api/chat/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'Build a chemistry simulator',
        generationMode: 'quality',
      })
      .expect(201);

    expect(submitResponse.body.data.message.contentJson).toEqual({
      generationMode: 'quality',
    });

    const hydrationResponse = await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(hydrationResponse.body.data.messages[0].contentJson).toEqual({
      generationMode: 'quality',
    });
  });

  it('lists only owner threads in updated-at order and rejects unauthenticated access', async () => {
    const ownerFirstThread = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Older thread' })
      .expect(201);

    const ownerSecondThread = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Newest thread' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_B_TOKEN}`)
      .send({ title: 'Other user thread' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(listResponse.body.data.threads).toHaveLength(2);
    expect(listResponse.body.data.threads[0].id).toBe(ownerSecondThread.body.data.thread.id);
    expect(listResponse.body.data.threads[1].id).toBe(ownerFirstThread.body.data.thread.id);
    expect(
      listResponse.body.data.threads.every(
        (thread: { userId: string }) => thread.userId === USER_A_ID,
      ),
    ).toBe(true);

    await request(app.getHttpServer()).get('/api/chat/threads').expect(401);
  });

  it('seeds title from first accepted prompt and preserves existing titles', async () => {
    const untitledCreate = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({})
      .expect(201);
    const untitledThreadId = untitledCreate.body.data.thread.id as string;

    await request(app.getHttpServer())
      .post(`/api/chat/threads/${untitledThreadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'Build a plane simulator for year 6 students',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const hydratedUntitledAfterFirstMessage = await request(app.getHttpServer())
      .get(`/api/chat/threads/${untitledThreadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(hydratedUntitledAfterFirstMessage.body.data.thread.title).toBe(
      'Build a plane simulator for year 6 students',
    );

    await request(app.getHttpServer())
      .post(`/api/chat/threads/${untitledThreadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'Completely different follow-up prompt text',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const hydratedUntitledAfterSecondMessage = await request(app.getHttpServer())
      .get(`/api/chat/threads/${untitledThreadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(hydratedUntitledAfterSecondMessage.body.data.thread.title).toBe(
      'Build a plane simulator for year 6 students',
    );

    const titledCreate = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Manual thread title' })
      .expect(201);
    const titledThreadId = titledCreate.body.data.thread.id as string;

    await request(app.getHttpServer())
      .post(`/api/chat/threads/${titledThreadId}/messages`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({
        content: 'First message should not override explicit title',
        idempotencyKey: randomUUID(),
      })
      .expect(201);

    const hydratedTitledThread = await request(app.getHttpServer())
      .get(`/api/chat/threads/${titledThreadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(hydratedTitledThread.body.data.thread.title).toBe('Manual thread title');
  });

  it('enforces authenticated streaming access and supports cursor replay semantics', async () => {
    const createThreadResponse = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .send({ title: 'Streaming thread' })
      .expect(201);

    const threadId = createThreadResponse.body.data.thread.id as string;
    chatRuntimeEvents.publish({
      threadId,
      type: 'run_started',
      payload: { phase: 'started' },
    });
    const middleEvent = chatRuntimeEvents.publish({
      threadId,
      type: 'assistant_message_started',
      payload: { draftId: 'run-1', content: 'Drafting...' },
    });
    const secondEvent = chatRuntimeEvents.publish({
      threadId,
      type: 'sandbox_updated',
      payload: { status: 'ready' },
    });

    await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}/events`)
      .set('Authorization', `Bearer ${USER_B_TOKEN}`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}/events`)
      .expect(401);

    const replayFromCursor = chatRuntimeEvents.stream(threadId, middleEvent.id);
    const replayedEvent = await firstValueFrom(
      replayFromCursor.pipe(take(1), timeout(1000)),
    );

    expect(replayedEvent.id).toBe(secondEvent.id);
    expect(replayedEvent.type).toBe('sandbox_updated');
    expect(replayedEvent.data).toMatchObject({
      threadId,
      payload: { status: 'ready' },
    });

    const hydratedThread = await request(app.getHttpServer())
      .get(`/api/chat/threads/${threadId}`)
      .set('Authorization', `Bearer ${USER_A_TOKEN}`)
      .expect(200);

    expect(hydratedThread.body.data.latestEventId).toBe(secondEvent.id);
  });
});

function createAuthUser(id: string, token: string): AuthenticatedUser {
  return {
    id,
    email: `${id}@example.test`,
    token,
    claims: {
      sub: id,
      email: `${id}@example.test`,
      aud: 'authenticated',
      iss: 'https://example.supabase.co/auth/v1',
    },
  };
}

function buildThreadTitleSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 93)}...`;
}
