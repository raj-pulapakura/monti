'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AppTopbar } from '@/app/components/app-topbar';
import { useAuthContext } from '@/app/context/auth-context';
import { useSupabaseClient } from '@/app/hooks/use-supabase-client';

const NAV = [
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/billing', label: 'Billing' },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuthContext();
  const getSupabaseClient = useSupabaseClient();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (user) {
      return;
    }
    const next = encodeURIComponent(pathname || '/settings');
    router.replace(`/sign-in?next=${next}`);
  }, [loading, user, pathname, router]);

  async function handleSignOut() {
    const { client } = getSupabaseClient();
    if (!client) {
      return;
    }
    await client.auth.signOut();
    router.replace('/');
  }

  if (loading) {
    return (
      <div className="page-shell settings-hub-shell">
        <AppTopbar onSignOut={() => void handleSignOut()} />
        <p className="settings-hub-loading" aria-live="polite">
          Loading…
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="page-shell settings-hub-shell">
      <AppTopbar onSignOut={() => void handleSignOut()} />
      <div className="settings-hub-body">
        <aside className="settings-hub-sidebar" aria-label="Settings">
          <p className="settings-hub-brand">Settings</p>
          <nav className="settings-hub-nav">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (pathname === '/settings' && item.href === '/settings/account');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`settings-hub-nav-link${active ? ' is-active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="settings-hub-main">{children}</div>
      </div>
    </div>
  );
}
