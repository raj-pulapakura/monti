/**
 * Written by `CreditsBalanceProvider` when billing loads. Kept in sync for any
 * code that reads balance outside React; the nav uses provider state directly.
 */
export type TopbarCreditsCache = {
  userId: string | null;
  hydrated: boolean;
  total: number | null;
};

let cache: TopbarCreditsCache = {
  userId: null,
  hydrated: false,
  total: null,
};

export function getTopbarCreditsCache(userId: string | null): {
  total: number | null;
  hydrated: boolean;
} {
  if (!userId || cache.userId !== userId) {
    return { total: null, hydrated: false };
  }
  return { total: cache.total, hydrated: cache.hydrated };
}

export function setTopbarCreditsCache(next: TopbarCreditsCache): void {
  cache = next;
}

export function clearTopbarCreditsCache(): void {
  cache = { userId: null, hydrated: false, total: null };
}
