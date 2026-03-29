type RequestLike = {
  url: string;
  headers: Pick<Headers, 'get'>;
};

export function resolveRequestOrigin(request: RequestLike): string {
  const configuredOrigin = resolveConfiguredOrigin();
  if (configuredOrigin) {
    return configuredOrigin;
  }

  const forwardedHost = firstHeaderValue(request.headers.get('x-forwarded-host'));
  if (forwardedHost) {
    const forwardedProto = firstHeaderValue(request.headers.get('x-forwarded-proto')) ?? 'https';
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

function resolveConfiguredOrigin(): string | null {
  const raw =
    process.env.SITE_URL?.trim() ??
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
    '';

  if (raw.length === 0) {
    return null;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function firstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(',')[0]?.trim();
  return first ? first : null;
}
