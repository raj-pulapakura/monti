import { Inject, Injectable } from '@nestjs/common';
import { AppError, ValidationError } from '../../common/errors/app-error';
import { SUPABASE_CLIENT } from '../../supabase/supabase.constants';
import type { Database, MontiSupabaseClient } from '../../supabase/supabase.types';

type ChatThreadRow = Database['public']['Tables']['chat_threads']['Row'];
type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row'];
type AssistantRunRow = Database['public']['Tables']['assistant_runs']['Row'];
type ToolInvocationRow = Database['public']['Tables']['tool_invocations']['Row'];
type SandboxStateRow = Database['public']['Tables']['sandbox_states']['Row'];

interface RpcSubmitRow {
  message_id: string;
  message_created_at: string;
  run_id: string | null;
  run_status: string | null;
  deduplicated: boolean;
}

interface ThreadListRow extends ChatThreadRow {
  sandbox_status: 'empty' | 'creating' | 'ready' | 'error' | null;
  sandbox_updated_at: string | null;
}

@Injectable()
export class ChatRuntimeRepository {
  constructor(
    @Inject(SUPABASE_CLIENT)
    private readonly client: MontiSupabaseClient,
  ) {}

  async listThreads(input: {
    userId: string;
    limit: number;
  }): Promise<ThreadListRow[]> {
    const { data: threads, error: threadsError } = await this.client
      .from('chat_threads')
      .select('*')
      .eq('user_id', input.userId)
      .order('updated_at', { ascending: false })
      .limit(input.limit);

    if (threadsError) {
      this.throwQueryError('list chat threads', threadsError);
    }

    const threadRows = threads ?? [];
    if (threadRows.length === 0) {
      return [];
    }

    const threadIds = threadRows.map((thread) => thread.id);
    const { data: sandboxStates, error: sandboxError } = await this.client
      .from('sandbox_states')
      .select('thread_id,status,updated_at')
      .in('thread_id', threadIds);

    if (sandboxError) {
      this.throwQueryError('list sandbox states for threads', sandboxError);
    }

    const sandboxByThread = new Map<
      string,
      {
        status: 'empty' | 'creating' | 'ready' | 'error';
        updatedAt: string;
      }
    >();
    (sandboxStates ?? []).forEach((row) => {
      sandboxByThread.set(row.thread_id, {
        status: row.status,
        updatedAt: row.updated_at,
      });
    });

    return threadRows.map((thread) => {
      const sandbox = sandboxByThread.get(thread.id);
      return {
        ...thread,
        sandbox_status: sandbox?.status ?? null,
        sandbox_updated_at: sandbox?.updatedAt ?? null,
      };
    });
  }

  async createThread(input: {
    userId: string;
    title?: string;
  }): Promise<{
    thread: ChatThreadRow;
    sandboxState: SandboxStateRow;
  }> {
    const { data: thread, error: threadError } = await this.client
      .from('chat_threads')
      .insert({
        user_id: input.userId,
        title: input.title ?? null,
      })
      .select('*')
      .single();

    if (threadError) {
      this.throwQueryError('create chat thread', threadError);
    }

    if (!thread) {
      throw new AppError('INTERNAL_ERROR', 'Created chat thread was not returned.', 500);
    }

    const { data: sandboxState, error: sandboxError } = await this.client
      .from('sandbox_states')
      .insert({
        thread_id: thread.id,
        status: 'empty',
      })
      .select('*')
      .single();

    if (sandboxError) {
      this.throwQueryError('create initial sandbox state', sandboxError);
    }

    if (!sandboxState) {
      throw new AppError('INTERNAL_ERROR', 'Created sandbox state was not returned.', 500);
    }

    return {
      thread,
      sandboxState,
    };
  }

  async hydrateThread(input: {
    threadId: string;
    userId: string;
  }): Promise<{
    thread: ChatThreadRow;
    messages: ChatMessageRow[];
    sandboxState: SandboxStateRow;
    activeRun: AssistantRunRow | null;
    activeToolInvocation: ToolInvocationRow | null;
  }> {
    const thread = await this.findThread(input);
    if (!thread) {
      throw new ValidationError('Thread not found for user scope.');
    }

    const [
      { data: messages, error: messagesError },
      { data: sandboxState, error: sandboxError },
      { data: activeRun, error: runError },
      { data: activeToolInvocation, error: toolError },
    ] = await Promise.all([
      this.client
        .from('chat_messages')
        .select('*')
        .eq('thread_id', input.threadId)
        .order('created_at', { ascending: true }),
      this.client
        .from('sandbox_states')
        .select('*')
        .eq('thread_id', input.threadId)
        .maybeSingle(),
      this.client
        .from('assistant_runs')
        .select('*')
        .eq('thread_id', input.threadId)
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from('tool_invocations')
        .select('*')
        .eq('thread_id', input.threadId)
        .in('status', ['pending', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (messagesError) {
      this.throwQueryError('load thread messages', messagesError);
    }

    if (sandboxError) {
      this.throwQueryError('load sandbox state', sandboxError);
    }

    if (runError) {
      this.throwQueryError('load active run', runError);
    }

    if (toolError) {
      this.throwQueryError('load active tool invocation', toolError);
    }

    if (!sandboxState) {
      throw new AppError('INTERNAL_ERROR', 'Sandbox state is missing for thread.', 500);
    }

    return {
      thread,
      messages: messages ?? [],
      sandboxState,
      activeRun: activeRun ?? null,
      activeToolInvocation: activeToolInvocation ?? null,
    };
  }

  async submitUserMessage(input: {
    threadId: string;
    content: string;
    idempotencyKey?: string;
  }): Promise<{
    message: ChatMessageRow;
    run: AssistantRunRow | null;
    deduplicated: boolean;
  }> {
    const { data, error } = await this.client.rpc('chat_submit_user_message', {
      p_thread_id: input.threadId,
      p_content: input.content,
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    if (error) {
      if (error.code === 'P0001') {
        throw new ValidationError(error.message);
      }

      if (error.code === 'PGRST202') {
        throw new AppError(
          'INTERNAL_ERROR',
          'Supabase chat submit RPC is outdated. Apply migration 20260318000100_harden_auth_rpc_and_rls.sql and retry.',
          500,
          {
            code: error.code ?? undefined,
            message: error.message,
            details: error.details ?? undefined,
            hint: error.hint ?? undefined,
          },
        );
      }

      this.throwQueryError('submit chat message', error);
    }

    const firstRow = Array.isArray(data) && data.length > 0 ? (data[0] as RpcSubmitRow) : null;
    if (!firstRow) {
      throw new AppError('INTERNAL_ERROR', 'Chat submit RPC returned no rows.', 500);
    }

    const [message, run] = await Promise.all([
      this.findMessageById(firstRow.message_id),
      firstRow.run_id ? this.findRunById(firstRow.run_id) : Promise.resolve(null),
    ]);

    if (!message) {
      throw new AppError('INTERNAL_ERROR', 'Submitted message was not found.', 500);
    }

    await this.seedThreadTitleIfEmpty({
      threadId: input.threadId,
      content: message.content,
    });

    return {
      message,
      run,
      deduplicated: firstRow.deduplicated,
    };
  }

  async updateMessageContentJson(input: {
    messageId: string;
    contentJson: Record<string, unknown> | null;
  }): Promise<ChatMessageRow> {
    const { data, error } = await this.client
      .from('chat_messages')
      .update({
        content_json: input.contentJson,
      })
      .eq('id', input.messageId)
      .select('*')
      .single();

    if (error) {
      this.throwQueryError('update chat message content_json', error);
    }

    return data;
  }

  async recordRunProviderTrace(input: {
    runId: string;
    providerRequestRaw: Record<string, unknown>;
    providerResponseRaw: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.client
      .from('assistant_runs')
      .update({
        provider_request_raw: input.providerRequestRaw,
        provider_response_raw: input.providerResponseRaw,
      })
      .eq('id', input.runId);

    if (error) {
      this.throwQueryError('record run provider trace', error);
    }
  }

  async recordRunRoutingDecision(input: {
    runId: string;
    tier: 'fast' | 'quality';
    confidence: number;
    reason: string;
    fallbackReason: string | null;
    selectedProvider: 'openai' | 'anthropic' | 'gemini';
    selectedModel: string;
  }): Promise<void> {
    const { error } = await this.client
      .from('assistant_runs')
      .update({
        router_tier: input.tier,
        router_provider_hint: null,
        router_confidence: input.confidence,
        router_reason: input.reason,
        router_fallback_reason: input.fallbackReason,
        provider: input.selectedProvider,
        model: input.selectedModel,
      })
      .eq('id', input.runId);

    if (error) {
      this.throwQueryError('record run routing decision', error);
    }
  }

  async recordToolInvocationRouterTelemetry(input: {
    invocationId: string;
    routerProvider: 'openai' | 'anthropic' | 'gemini';
    routerModel: string;
    routerRequestRaw: Record<string, unknown>;
    routerResponseRaw: Record<string, unknown>;
    routerTokensIn?: number | null;
    routerTokensOut?: number | null;
    routerTier?: 'fast' | 'quality' | null;
    routerConfidence?: number | null;
    routerReason?: string | null;
    routerFallbackReason?: string | null;
    selectedProvider?: 'openai' | 'anthropic' | 'gemini' | null;
    selectedModel?: string | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('tool_invocations')
      .update({
        router_provider: input.routerProvider,
        router_model: input.routerModel,
        router_request_raw: input.routerRequestRaw,
        router_response_raw: input.routerResponseRaw,
        router_tokens_in: input.routerTokensIn ?? null,
        router_tokens_out: input.routerTokensOut ?? null,
        router_tier: input.routerTier ?? null,
        router_confidence: input.routerConfidence ?? null,
        router_reason: input.routerReason ?? null,
        router_fallback_reason: input.routerFallbackReason ?? null,
        selected_provider: input.selectedProvider ?? null,
        selected_model: input.selectedModel ?? null,
      })
      .eq('id', input.invocationId);

    if (error) {
      this.throwQueryError('record tool invocation router telemetry', error);
    }
  }

  async getRunById(runId: string): Promise<AssistantRunRow | null> {
    return this.findRunById(runId);
  }

  async assertThreadAccess(input: {
    threadId: string;
    userId: string;
  }): Promise<void> {
    const thread = await this.findThread(input);
    if (!thread) {
      throw new ValidationError('Thread not found for user scope.');
    }
  }

  async getSandboxPreview(input: {
    threadId: string;
    userId: string;
  }): Promise<{
    sandboxState: SandboxStateRow;
    activeExperience: {
      title: string;
      description: string;
      html: string;
      css: string;
      js: string;
      generationId: string;
      slug: string | null;
    } | null;
  }> {
    const thread = await this.findThread(input);
    if (!thread) {
      throw new ValidationError('Thread not found for user scope.');
    }

    const { data: sandboxState, error: sandboxError } = await this.client
      .from('sandbox_states')
      .select('*')
      .eq('thread_id', input.threadId)
      .maybeSingle();

    if (sandboxError) {
      this.throwQueryError('load sandbox preview state', sandboxError);
    }

    if (!sandboxState) {
      throw new AppError('INTERNAL_ERROR', 'Sandbox state is missing for thread.', 500);
    }

    if (!sandboxState.experience_version_id) {
      return {
        sandboxState,
        activeExperience: null,
      };
    }

    const [{ data: version, error: versionError }, { data: experience, error: experienceError }] =
      await Promise.all([
        this.client
          .from('experience_versions')
          .select('title,description,html,css,js,generation_id')
          .eq('id', sandboxState.experience_version_id)
          .maybeSingle(),
        sandboxState.experience_id
          ? this.client
              .from('experiences')
              .select('slug')
              .eq('id', sandboxState.experience_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

    if (versionError) {
      this.throwQueryError('load active sandbox experience version', versionError);
    }

    if (experienceError) {
      this.throwQueryError('load experience slug', experienceError);
    }

    return {
      sandboxState,
      activeExperience: version
        ? {
            title: version.title,
            description: version.description,
            html: version.html,
            css: version.css,
            js: version.js,
            generationId: version.generation_id,
            slug: experience?.slug ?? null,
          }
        : null,
    };
  }

  async markRunRunning(
    runId: string,
    options?: {
      conversationProvider?: 'openai' | 'anthropic' | 'gemini';
      conversationModel?: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from('assistant_runs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        conversation_provider: options?.conversationProvider ?? null,
        conversation_model: options?.conversationModel ?? null,
        error_code: null,
        error_message: null,
      })
      .eq('id', runId);

    if (error) {
      this.throwQueryError('mark run as running', error);
    }
  }

  async markRunSucceeded(input: {
    runId: string;
    assistantMessageId: string;
    conversationTokensIn?: number | null;
    conversationTokensOut?: number | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('assistant_runs')
      .update({
        status: 'succeeded',
        assistant_message_id: input.assistantMessageId,
        conversation_tokens_in: input.conversationTokensIn ?? null,
        conversation_tokens_out: input.conversationTokensOut ?? null,
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq('id', input.runId);

    if (error) {
      this.throwQueryError('mark run as succeeded', error);
    }
  }

  async markRunFailed(input: {
    runId: string;
    errorCode: string;
    errorMessage: string;
    assistantMessageId?: string | null;
    conversationTokensIn?: number | null;
    conversationTokensOut?: number | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('assistant_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        assistant_message_id: input.assistantMessageId ?? null,
        conversation_tokens_in: input.conversationTokensIn ?? null,
        conversation_tokens_out: input.conversationTokensOut ?? null,
        error_code: input.errorCode,
        error_message: input.errorMessage,
      })
      .eq('id', input.runId);

    if (error) {
      this.throwQueryError('mark run as failed', error);
    }
  }

  async createAssistantMessage(input: {
    threadId: string;
    userId: string;
    content: string;
    contentJson?: Record<string, unknown> | null;
  }): Promise<ChatMessageRow> {
    const { data, error } = await this.client
      .from('chat_messages')
      .insert({
        thread_id: input.threadId,
        user_id: input.userId,
        role: 'assistant',
        content: input.content,
        content_json: input.contentJson ?? null,
      })
      .select('*')
      .single();

    if (error) {
      this.throwQueryError('create assistant message', error);
    }

    return data;
  }

  async createToolInvocation(input: {
    threadId: string;
    runId: string;
    providerToolCallId?: string | null;
    toolName: string;
    toolArguments: Record<string, unknown>;
  }): Promise<ToolInvocationRow> {
    const { data, error } = await this.client
      .from('tool_invocations')
      .insert({
        thread_id: input.threadId,
        run_id: input.runId,
        provider_tool_call_id: input.providerToolCallId ?? null,
        tool_name: input.toolName,
        tool_arguments: input.toolArguments,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      this.throwQueryError('create tool invocation', error);
    }

    return data;
  }

  async markToolInvocationSucceeded(input: {
    invocationId: string;
    toolResult: Record<string, unknown>;
    generationId?: string | null;
    experienceId?: string | null;
    experienceVersionId?: string | null;
    routerTier?: 'fast' | 'quality' | null;
    routerConfidence?: number | null;
    routerReason?: string | null;
    routerFallbackReason?: string | null;
    selectedProvider?: 'openai' | 'anthropic' | 'gemini' | null;
    selectedModel?: string | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('tool_invocations')
      .update({
        status: 'succeeded',
        tool_result: input.toolResult,
        generation_id: input.generationId ?? null,
        experience_id: input.experienceId ?? null,
        experience_version_id: input.experienceVersionId ?? null,
        router_tier: input.routerTier ?? null,
        router_confidence: input.routerConfidence ?? null,
        router_reason: input.routerReason ?? null,
        router_fallback_reason: input.routerFallbackReason ?? null,
        selected_provider: input.selectedProvider ?? null,
        selected_model: input.selectedModel ?? null,
        error_code: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.invocationId);

    if (error) {
      this.throwQueryError('mark tool invocation as succeeded', error);
    }
  }

  async markToolInvocationFailed(input: {
    invocationId: string;
    errorCode: string;
    errorMessage: string;
    toolResult?: Record<string, unknown> | null;
    routerTier?: 'fast' | 'quality' | null;
    routerConfidence?: number | null;
    routerReason?: string | null;
    routerFallbackReason?: string | null;
    selectedProvider?: 'openai' | 'anthropic' | 'gemini' | null;
    selectedModel?: string | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('tool_invocations')
      .update({
        status: 'failed',
        tool_result: input.toolResult ?? null,
        router_tier: input.routerTier ?? null,
        router_confidence: input.routerConfidence ?? null,
        router_reason: input.routerReason ?? null,
        router_fallback_reason: input.routerFallbackReason ?? null,
        selected_provider: input.selectedProvider ?? null,
        selected_model: input.selectedModel ?? null,
        error_code: input.errorCode,
        error_message: input.errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.invocationId);

    if (error) {
      this.throwQueryError('mark tool invocation as failed', error);
    }
  }

  async updateSandboxState(input: {
    threadId: string;
    status: 'empty' | 'creating' | 'ready' | 'error';
    experienceId?: string | null;
    experienceVersionId?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  }): Promise<void> {
    const { error } = await this.client
      .from('sandbox_states')
      .upsert({
        thread_id: input.threadId,
        status: input.status,
        experience_id: input.experienceId ?? null,
        experience_version_id: input.experienceVersionId ?? null,
        last_error_code: input.lastErrorCode ?? null,
        last_error_message: input.lastErrorMessage ?? null,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      this.throwQueryError('update sandbox state', error);
    }
  }

  async findExperienceVersionByGenerationId(generationId: string): Promise<{
    experienceId: string;
    versionId: string;
  } | null> {
    const { data, error } = await this.client
      .from('experience_versions')
      .select('id,experience_id')
      .eq('generation_id', generationId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find experience version by generation id', error);
    }

    if (!data) {
      return null;
    }

    return {
      experienceId: data.experience_id,
      versionId: data.id,
    };
  }

  private async findThread(input: {
    threadId: string;
    userId: string;
  }): Promise<ChatThreadRow | null> {
    const { data, error } = await this.client
      .from('chat_threads')
      .select('*')
      .eq('id', input.threadId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find thread', error);
    }

    return data;
  }

  private async findMessageById(messageId: string): Promise<ChatMessageRow | null> {
    const { data, error } = await this.client
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find message by id', error);
    }

    return data;
  }

  private async findRunById(runId: string): Promise<AssistantRunRow | null> {
    const { data, error } = await this.client
      .from('assistant_runs')
      .select('*')
      .eq('id', runId)
      .maybeSingle();

    if (error) {
      this.throwQueryError('find run by id', error);
    }

    return data;
  }

  private async seedThreadTitleIfEmpty(input: {
    threadId: string;
    content: string;
  }): Promise<void> {
    const normalizedTitle = buildThreadTitleSnippet(input.content);
    if (!normalizedTitle) {
      return;
    }

    const { error } = await this.client
      .from('chat_threads')
      .update({
        title: normalizedTitle,
      })
      .eq('id', input.threadId)
      .is('title', null);

    if (error) {
      this.throwQueryError('seed thread title from first message', error);
    }
  }

  private throwQueryError(action: string, error: {
    message: string;
    code?: string | null;
    details?: string | null;
    hint?: string | null;
  }): never {
    throw new AppError(
      'INTERNAL_ERROR',
      `Failed to ${action}.`,
      500,
      {
        code: error.code ?? undefined,
        message: error.message,
        details: error.details ?? undefined,
        hint: error.hint ?? undefined,
      },
    );
  }
}

function buildThreadTitleSnippet(content: string): string | null {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return null;
  }

  const maxLength = 96;
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3)}...`;
}
