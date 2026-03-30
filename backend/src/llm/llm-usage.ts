export type LlmUsageAvailability = 'observed' | 'unavailable';

export interface LlmUsageTelemetry {
  availability: LlmUsageAvailability;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  rawUsage: Record<string, unknown> | null;
}

export function observedUsage(input: {
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number;
  rawUsage?: Record<string, unknown> | null;
}): LlmUsageTelemetry {
  return {
    availability: 'observed',
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.totalTokens ?? input.inputTokens + input.outputTokens,
    rawUsage: input.rawUsage ?? null,
  };
}

export function unavailableUsage(
  rawUsage?: Record<string, unknown> | null,
): LlmUsageTelemetry {
  return {
    availability: 'unavailable',
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    rawUsage: rawUsage ?? null,
  };
}

export function hasObservedUsage(usage: LlmUsageTelemetry): boolean {
  return (
    usage.availability === 'observed' &&
    typeof usage.inputTokens === 'number' &&
    typeof usage.outputTokens === 'number'
  );
}

export function aggregateObservedUsage(
  usageEntries: readonly LlmUsageTelemetry[],
): LlmUsageTelemetry {
  if (usageEntries.length === 0) {
    return unavailableUsage();
  }

  if (usageEntries.some((usage) => !hasObservedUsage(usage))) {
    return unavailableUsage();
  }

  const inputTokens = usageEntries.reduce(
    (total, usage) => total + (usage.inputTokens ?? 0),
    0,
  );
  const outputTokens = usageEntries.reduce(
    (total, usage) => total + (usage.outputTokens ?? 0),
    0,
  );
  const totalTokens = usageEntries.reduce(
    (total, usage) => total + (usage.totalTokens ?? 0),
    0,
  );

  return observedUsage({
    inputTokens,
    outputTokens,
    totalTokens,
  });
}

export function toUsageCounts(usage: LlmUsageTelemetry): {
  tokensIn: number | null;
  tokensOut: number | null;
} {
  if (!hasObservedUsage(usage)) {
    return {
      tokensIn: null,
      tokensOut: null,
    };
  }

  return {
    tokensIn: usage.inputTokens,
    tokensOut: usage.outputTokens,
  };
}

export function usageFromErrorDetails(details: unknown): LlmUsageTelemetry | null {
  if (!isRecord(details) || !('usage' in details)) {
    return null;
  }

  return isUsageTelemetry(details.usage) ? details.usage : null;
}

function isUsageTelemetry(value: unknown): value is LlmUsageTelemetry {
  if (!isRecord(value)) {
    return false;
  }

  const availability = value.availability;
  if (availability !== 'observed' && availability !== 'unavailable') {
    return false;
  }

  return (
    isNullableNumber(value.inputTokens) &&
    isNullableNumber(value.outputTokens) &&
    isNullableNumber(value.totalTokens) &&
    (value.rawUsage === null || isRecord(value.rawUsage))
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
