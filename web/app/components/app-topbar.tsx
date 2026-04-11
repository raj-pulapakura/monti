'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, CreditCard, LogOut, UserRound } from 'lucide-react';
import { useDropdownMenu } from '@/app/hooks/use-dropdown-menu';

export function AppTopbar(input: { onSignOut: () => void }) {
  const { open: menuOpen, setOpen: setMenuOpen, menuRef } = useDropdownMenu();
  const [scrolled, setScrolled] = useState(false);

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

        <div className="profile-menu-shell" ref={menuRef}>
          <button
            type="button"
            className="topbar-profile-button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((previous) => !previous)}
          >
            <UserRound size={16} strokeWidth={2.2} />
            <span>Profile</span>
            <ChevronDown
              size={14}
              strokeWidth={2.2}
              className={`profile-chevron ${menuOpen ? 'is-open' : ''}`}
            />
          </button>

          {menuOpen ? (
            <div className="profile-menu" role="menu" aria-label="Profile options">
              <Link
                href="/billing"
                role="menuitem"
                className="profile-menu-item"
                onClick={() => setMenuOpen(false)}
              >
                <CreditCard size={16} strokeWidth={2.2} />
                <span>Billing &amp; plan</span>
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
    </nav>
  );
}
