export const CLIENT_ID_STORAGE_KEY = 'monti_client_id_v1';

export function getOrCreateClientId(storage = getBrowserStorage()) {
  if (!storage) {
    return 'unknown-client';
  }

  const existing = storage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing && existing.trim().length > 0) {
    return existing;
  }

  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fallback-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  storage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
}

function getBrowserStorage() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }

  return window.localStorage;
}
