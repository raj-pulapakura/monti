export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_REFUSAL'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_RESPONSE_INVALID'
  | 'PROVIDER_MAX_TOKENS'
  | 'SAFETY_VIOLATION'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class ProviderTimeoutError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PROVIDER_TIMEOUT', message, 504, details);
    this.name = 'ProviderTimeoutError';
  }
}

export class ProviderRefusalError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PROVIDER_REFUSAL', message, 422, details);
    this.name = 'ProviderRefusalError';
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PROVIDER_UNAVAILABLE', message, 503, details);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderResponseError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PROVIDER_RESPONSE_INVALID', message, 502, details);
    this.name = 'ProviderResponseError';
  }
}

export class ProviderMaxTokensError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PROVIDER_MAX_TOKENS', message, 502, details);
    this.name = 'ProviderMaxTokensError';
  }
}

export class SafetyViolationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('SAFETY_VIOLATION', message, 422, details);
    this.name = 'SafetyViolationError';
  }
}
