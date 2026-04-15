'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createAuthenticatedApiClient } from '@/lib/api/authenticated-api-client';
import type { BillingMeResponse } from '@/lib/api/billing-me';
import { clearTopbarCreditsCache, setTopbarCreditsCache } from '@/app/components/topbar-credits-cache';
import { useAuthContext } from '@/app/context/auth-context';

type CreditsBalanceContextValue = {
  totalCredits: number | null;
  creditsLoading: boolean;
  /** Silent refetch; returns latest billing payload (or null on error / no session). */
  refreshCredits: () => Promise<BillingMeResponse['data'] | null>;
};

const CreditsBalanceContext = createContext<CreditsBalanceContextValue | undefined>(undefined);

function applyBillingResponse(data: BillingMeResponse['data'], userId: string): number | null {
  if (!data.billingEnabled) {
    setTopbarCreditsCache({ userId, hydrated: true, total: null });
    return null;
  }
  const next =
    data.totalSpendableCredits != null
      ? data.totalSpendableCredits
      : (data.includedCreditsAvailable ?? 0) + (data.topupCreditsAvailable ?? 0);
  setTopbarCreditsCache({ userId, hydrated: true, total: next });
  return next;
}

export function CreditsBalanceProvider({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuthContext();
  const [totalCredits, setTotalCredits] = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const creditsHydratedRef = useRef(false);
  const silentRefreshRef = useRef<Promise<BillingMeResponse['data'] | null> | null>(null);

  const refreshCredits = useCallback(async () => {
    if (silentRefreshRef.current) {
      return silentRefreshRef.current;
    }
    const token = session?.access_token;
    const uid = session?.user?.id ?? null;
    if (!token || !uid) {
      return Promise.resolve(null);
    }

    const run = (async (): Promise<BillingMeResponse['data'] | null> => {
      try {
        const response = await createAuthenticatedApiClient(token).getJson<BillingMeResponse>('/api/billing/me');
        const next = applyBillingResponse(response.data, uid);
        setTotalCredits(next);
        return response.data;
      } catch {
        return null;
      } finally {
        silentRefreshRef.current = null;
      }
    })();

    silentRefreshRef.current = run;
    return run;
  }, [session?.access_token, session?.user?.id]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    const token = session?.access_token;
    const uid = session?.user?.id ?? null;
    if (!token || !uid) {
      setTotalCredits(null);
      setCreditsLoading(false);
      creditsHydratedRef.current = false;
      clearTopbarCreditsCache();
      return;
    }

    let cancelled = false;
    const showInitialSpinner = !creditsHydratedRef.current;
    if (showInitialSpinner) {
      setCreditsLoading(true);
    }

    void (async () => {
      try {
        const response = await createAuthenticatedApiClient(token).getJson<BillingMeResponse>('/api/billing/me');
        if (cancelled) {
          return;
        }
        const next = applyBillingResponse(response.data, uid);
        setTotalCredits(next);
      } catch {
        if (!cancelled && !creditsHydratedRef.current) {
          setTotalCredits(null);
          setTopbarCreditsCache({ userId: uid, hydrated: true, total: null });
        }
      } finally {
        if (!cancelled) {
          creditsHydratedRef.current = true;
          setCreditsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session?.access_token, session?.user?.id]);

  const value = useMemo(
    () => ({
      totalCredits,
      creditsLoading,
      refreshCredits,
    }),
    [totalCredits, creditsLoading, refreshCredits],
  );

  return <CreditsBalanceContext.Provider value={value}>{children}</CreditsBalanceContext.Provider>;
}

export function useCreditsBalance(): CreditsBalanceContextValue {
  const context = useContext(CreditsBalanceContext);
  if (context === undefined) {
    throw new Error('useCreditsBalance must be used within a CreditsBalanceProvider');
  }
  return context;
}
