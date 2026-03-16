import { ValidationError } from '../../common/errors/app-error';
import type {
  AssistantRunEnvelope,
  ChatMessageEnvelope,
  SandboxStateEnvelope,
  ToolInvocationEnvelope,
} from '../runtime.types';

export interface CreateThreadRequest {
  title?: string;
}

export interface SubmitMessageRequest {
  content: string;
  idempotencyKey?: string;
}

export interface HydrateThreadRequest {
  threadId: string;
}

export interface ThreadEnvelope {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadHydrationPayload {
  thread: ThreadEnvelope;
  messages: ChatMessageEnvelope[];
  sandboxState: SandboxStateEnvelope;
  activeRun: AssistantRunEnvelope | null;
  activeToolInvocation: ToolInvocationEnvelope | null;
  latestEventId: string | null;
}

export interface SubmitMessagePayload {
  threadId: string;
  message: ChatMessageEnvelope;
  run: AssistantRunEnvelope | null;
  deduplicated: boolean;
}

export function parseCreateThreadRequest(body: unknown): CreateThreadRequest {
  const object = asRecord(body, 'Request body must be a JSON object.');

  return {
    title: asOptionalString(object.title, 'title'),
  };
}

export function parseHydrateThreadRequest(threadId: string, query: unknown): HydrateThreadRequest {
  if (!isUuidLike(threadId)) {
    throw new ValidationError('threadId must be a UUID string.');
  }

  asRecord(query, 'Query params must be an object.');

  return {
    threadId,
  };
}

export function parseSubmitMessageRequest(threadId: string, body: unknown): {
  threadId: string;
  request: SubmitMessageRequest;
} {
  if (!isUuidLike(threadId)) {
    throw new ValidationError('threadId must be a UUID string.');
  }

  const object = asRecord(body, 'Request body must be a JSON object.');

  return {
    threadId,
    request: {
      content: asRequiredString(object.content, 'content'),
      idempotencyKey: asOptionalString(object.idempotencyKey, 'idempotencyKey'),
    },
  };
}

export function parseStreamEventsRequest(threadId: string, query: unknown): {
  threadId: string;
  cursor?: string;
} {
  return parseStreamEventsRequestWithHeader(threadId, query);
}

export function parseStreamEventsRequestWithHeader(
  threadId: string,
  query: unknown,
  lastEventIdHeader?: string | string[] | undefined,
): {
  threadId: string;
  cursor?: string;
} {
  if (!isUuidLike(threadId)) {
    throw new ValidationError('threadId must be a UUID string.');
  }

  const object = asRecord(query, 'Query params must be an object.');
  const cursor = asOptionalString(object.cursor, 'cursor');
  const headerValue = Array.isArray(lastEventIdHeader)
    ? lastEventIdHeader[0]
    : lastEventIdHeader;
  const normalizedHeaderCursor = asOptionalString(headerValue, 'last-event-id');

  return {
    threadId,
    cursor: cursor ?? normalizedHeaderCursor,
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }

  return value as Record<string, unknown>;
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function asOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string when provided.`);
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
