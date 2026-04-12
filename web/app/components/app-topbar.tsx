'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Coins, LoaderCircle, LogOut, Settings } from 'lucide-react';
import { useDropdownMenu } from '@/app/hooks/use-dropdown-menu';
import { useAuthContext } from '@/app/context/auth-context';
import { useCreditsBalance } from '@/app/context/credits-balance-context';
import { deriveInitialsFromUser } from '@/lib/auth/derive-initials';

export function AppTopbar(input: { onSignOut: () => void }) {
  const { open: menuOpen, setOpen: setMenuOpen, menuRef } = useDropdownMenu();
  const [scrolled, setScrolled] = useState(false);
  const { user, session, loading: authLoading } = useAuthContext();
  const { totalCredits, creditsLoading } = useCreditsBalance();
  const initials = deriveInitialsFromUser(user);
  const label = authLoading ? '…' : initials;

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="app-topbar">
      <div className={`app-topbar-inner${scrolled ? ' is-scrolled' : ''}`}>
        <Link href="/" className="app-topbar-wordmark">
          Monti
        </Link>

        <div className="app-topbar-end">
          {!authLoading && session ? (
            <Link
              href="/settings/billing"
              className={`app-topbar-credits${creditsLoading ? ' is-loading' : ''}`}
              aria-busy={creditsLoading}
              aria-label={
                creditsLoading
                  ? 'Loading credit balance'
                  : totalCredits !== null
                    ? `${totalCredits} credits available`
                    : 'Credits unavailable'
              }
            >
              {creditsLoading ? (
                <LoaderCircle className="app-topbar-credits-spinner" size={15} strokeWidth={2.2} aria-hidden />
              ) : (
                <>
                  <Coins size={15} strokeWidth={2.2} aria-hidden />
                  <span className="app-topbar-credits-value">
                    {totalCredits !== null ? totalCredits : '—'}
                  </span>
                </>
              )}
            </Link>
          ) : null}

          <div className="profile-menu-shell" ref={menuRef}>
            <button
              type="button"
              className={`profile-initials-button profile-initials-button--topbar${authLoading ? ' is-loading' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
              onClick={() => setMenuOpen((previous) => !previous)}
            >
              <span className="profile-initials-circle">{label}</span>
            </button>

            {menuOpen ? (
              <div className="profile-menu" role="menu" aria-label="Account options">
                <Link
                  href="/settings"
                  role="menuitem"
                  className="profile-menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={16} strokeWidth={2.2} />
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  className="profile-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    input.onSignOut();
                  }}
                >
                  <LogOut size={16} strokeWidth={2.2} />
                  <span>Sign out</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
