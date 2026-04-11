import { ValidationError } from '../common/errors/app-error';

export type ParsedFeedbackSubmit = {
  kind: 'general' | 'thumbs_up' | 'thumbs_down';
  message: string | null;
  threadId: string | null;
  messageId: string | null;
  experienceId: string | null;
};

export function parseFeedbackRequest(body: unknown): ParsedFeedbackSubmit {
  const object = asRecord(body, 'Request body must be a JSON object.');
  const kind = asKind(object.kind);

  if (kind === 'general') {
    const message = asRequiredTrimmedString(object.message, 'message');
    if (
      object.thread_id !== undefined &&
      object.thread_id !== null &&
      object.thread_id !== ''
    ) {
      throw new ValidationError('General feedback must not include thread_id.');
    }
    if (
      object.message_id !== undefined &&
      object.message_id !== null &&
      object.message_id !== ''
    ) {
      throw new ValidationError('General feedback must not include message_id.');
    }
    if (
      object.experience_id !== undefined &&
      object.experience_id !== null &&
      object.experience_id !== ''
    ) {
      throw new ValidationError('General feedback must not include experience_id.');
    }

    return {
      kind,
      message,
      threadId: null,
      messageId: null,
      experienceId: null,
    };
  }

  const threadId = asRequiredUuid(object.thread_id, 'thread_id');
  const messageId = asRequiredUuid(object.message_id, 'message_id');
  const experienceId = asOptionalUuid(object.experience_id, 'experience_id');
  const message = asOptionalMessage(object.message);

  return {
    kind,
    message,
    threadId,
    messageId,
    experienceId,
  };
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(message);
  }

  return value as Record<string, unknown>;
}

function asKind(value: unknown): 'general' | 'thumbs_up' | 'thumbs_down' {
  if (value === 'general' || value === 'thumbs_up' || value === 'thumbs_down') {
    return value;
  }

  throw new ValidationError('kind must be one of: general, thumbs_up, thumbs_down.');
}

function asRequiredTrimmedString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
  }

  return trimmed;
}

function asOptionalMessage(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError('message must be a string when provided.');
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asRequiredUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a UUID string.`);
  }

  const trimmed = value.trim();
  if (!isUuidLike(trimmed)) {
    throw new ValidationError(`${fieldName} must be a UUID string.`);
  }

  return trimmed;
}

function asOptionalUuid(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a UUID string when provided.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!isUuidLike(trimmed)) {
    throw new ValidationError(`${fieldName} must be a UUID string when provided.`);
  }

  return trimmed;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
