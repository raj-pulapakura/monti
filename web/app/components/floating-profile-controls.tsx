'use client';

import Link from 'next/link';
import { ChevronDown, Home, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function FloatingProfileControls(input: {
  onSignOut: () => void;
  homeHref?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="floating-controls">
      {input.homeHref ? (
        <Link href={input.homeHref} className="floating-icon-button" aria-label="Go to home">
          <Home size={18} strokeWidth={2.2} />
        </Link>
      ) : null}

      <div className="profile-menu-shell" ref={menuRef}>
        <button
          type="button"
          className="floating-profile-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((previous) => !previous)}
        >
          <UserRound size={18} strokeWidth={2.2} />
          <span>Profile</span>
          <ChevronDown
            size={16}
            strokeWidth={2.2}
            className={`profile-chevron ${menuOpen ? 'is-open' : ''}`}
          />
        </button>

        {menuOpen ? (
          <div className="profile-menu" role="menu" aria-label="Profile options">
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
  );
}
