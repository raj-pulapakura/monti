export const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001').replace(
    /\/+$/,
    '',
  );

type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function createAuthenticatedApiClient(accessToken: string) {
  return {
    getJson<TResponse>(path: string): Promise<TResponse> {
      return requestJson<TResponse>({
        method: 'GET',
        path,
        accessToken,
      });
    },
    postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
      return requestJson<TResponse>({
        method: 'POST',
        path,
        body,
        accessToken,
      });
    },
    patchJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
      return requestJson<TResponse>({
        method: 'PATCH',
        path,
        body,
        accessToken,
      });
    },
    deleteJson<TResponse>(path: string): Promise<TResponse> {
      return requestJson<TResponse>({
        method: 'DELETE',
        path,
        accessToken,
      });
    },
  };
}

async function requestJson<TResponse>(input: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  accessToken: string;
  body?: unknown;
}): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${input.path}`, {
    method: input.method,
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      ...(input.method === 'POST' || input.method === 'PATCH'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      input.method === 'POST' || input.method === 'PATCH'
        ? JSON.stringify(input.body ?? {})
        : undefined,
  });

  const responseBody = (await response.json().catch(() => null)) as
    | TResponse
    | ErrorResponse
    | null;

  if (!response.ok) {
    const message =
      responseBody && typeof responseBody === 'object' && 'error' in responseBody
        ? responseBody.error.message
        : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!responseBody) {
    throw new Error('Server returned an empty response.');
  }

  return responseBody as TResponse;
}
