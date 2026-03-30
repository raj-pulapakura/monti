import {
  observedUsage,
  unavailableUsage,
  type LlmUsageTelemetry,
} from './llm-usage';

export function normalizeOpenAiUsage(usage: {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
} | null | undefined): LlmUsageTelemetry {
  const inputTokens = asNonNegativeInt(usage?.input_tokens);
  const outputTokens = asNonNegativeInt(usage?.output_tokens);
  const totalTokens = asNonNegativeInt(usage?.total_tokens);

  if (inputTokens === null || outputTokens === null) {
    return unavailableUsage(asRecord(usage));
  }

  return observedUsage({
    inputTokens,
    outputTokens,
    totalTokens: totalTokens ?? inputTokens + outputTokens,
    rawUsage: asRecord(usage),
  });
}

export function normalizeAnthropicUsage(usage: {
  input_tokens?: number;
  output_tokens?: number;
} | null | undefined): LlmUsageTelemetry {
  const inputTokens = asNonNegativeInt(usage?.input_tokens);
  const outputTokens = asNonNegativeInt(usage?.output_tokens);

  if (inputTokens === null || outputTokens === null) {
    return unavailableUsage(asRecord(usage));
  }

  return observedUsage({
    inputTokens,
    outputTokens,
    rawUsage: asRecord(usage),
  });
}

export function normalizeGeminiUsage(usage: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
} | null | undefined): LlmUsageTelemetry {
  const inputTokens = asNonNegativeInt(usage?.promptTokenCount);
  const outputTokens = asNonNegativeInt(usage?.candidatesTokenCount);
  const totalTokens = asNonNegativeInt(usage?.totalTokenCount);

  if (inputTokens === null || outputTokens === null) {
    return unavailableUsage(asRecord(usage));
  }

  return observedUsage({
    inputTokens,
    outputTokens,
    totalTokens: totalTokens ?? inputTokens + outputTokens,
    rawUsage: asRecord(usage),
  });
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
