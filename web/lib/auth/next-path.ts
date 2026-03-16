const DEFAULT_NEXT_PATH = '/app';

export function resolveSafeNextPath(
  nextPath: string | null | undefined,
  fallbackPath = DEFAULT_NEXT_PATH,
): string {
  if (!nextPath) {
    return fallbackPath;
  }

  const trimmed = nextPath.trim();
  if (trimmed.length === 0 || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (!parsed.pathname.startsWith('/')) {
      return fallbackPath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}
