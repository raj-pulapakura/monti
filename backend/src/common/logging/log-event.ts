export function logEvent(
  event: string,
  fields: Record<string, unknown> = {},
): string {
  return JSON.stringify(
    {
      at: new Date().toISOString(),
      event,
      ...fields,
    },
    (_key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
        };
      }

      if (typeof value === 'bigint') {
        return value.toString();
      }

      return value;
    },
  );
}
