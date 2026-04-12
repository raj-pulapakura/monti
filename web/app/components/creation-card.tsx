'use client';

import { MoreVertical, Pencil, Star, Trash2 } from 'lucide-react';
import { buildSrcdoc } from '@/lib/preview';
import { useDropdownMenu } from '@/app/hooks/use-dropdown-menu';

type ThreadCard = {
  id: string;
  userId: string;
  title: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sandboxStatus: 'empty' | 'creating' | 'ready' | 'error' | null;
  sandboxUpdatedAt: string | null;
  experienceHtml?: string | null;
  experienceCss?: string | null;
  experienceJs?: string | null;
  experienceTitle?: string | null;
  isFavourite: boolean;
};

export function CreationCard(input: {
  thread: ThreadCard;
  favouritePending: boolean;
  onOpen: () => void;
  onFavouriteToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { thread, favouritePending } = input;
  const title = threadCardDisplayTitle(thread);
  const secondary = threadCardSecondaryTitle(thread);
  const hasPreview = isThreadPreviewReady(thread);
  const canRename = thread.sandboxStatus === 'ready';
  const { open: menuOpen, setOpen: setMenuOpen, menuRef } = useDropdownMenu();

  return (
    <div
      className="creation-card"
      role="listitem"
      tabIndex={0}
      aria-label={`Open ${title}`}
      onClick={input.onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          input.onOpen();
        }
      }}
    >
      <div className="creation-thumb">
        <div className="creation-card-menu-shell" ref={menuRef}>
          <button
            type="button"
            className="creation-card-overflow"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Creation actions"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((previous) => !previous);
            }}
          >
            <MoreVertical size={17} strokeWidth={2} aria-hidden />
          </button>
          {menuOpen ? (
            <div className="creation-card-dropdown profile-menu" role="menu" aria-label="Creation actions">
              <button
                type="button"
                role="menuitem"
                className="profile-menu-item"
                disabled={!canRename}
                title={
                  canRename
                    ? undefined
                    : 'Rename is available when the experience has finished generating.'
                }
                onClick={(event) => {
                  event.stopPropagation();
                  if (!canRename) {
                    return;
                  }
                  input.onRename();
                  setMenuOpen(false);
                }}
              >
                <Pencil size={16} strokeWidth={2.2} aria-hidden />
                <span>Rename</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="profile-menu-item creation-card-menu-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  input.onDelete();
                  setMenuOpen(false);
                }}
              >
                <Trash2 size={16} strokeWidth={2.2} aria-hidden />
                <span>Delete</span>
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={`creation-card-star${thread.isFavourite ? ' is-favourited' : ''}`}
          aria-label={thread.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          title={thread.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          disabled={favouritePending || thread.sandboxStatus !== 'ready'}
          onClick={(event) => {
            event.stopPropagation();
            input.onFavouriteToggle();
          }}
        >
          <Star size={17} strokeWidth={2} aria-hidden />
        </button>
        {hasPreview ? (
          <div className="creation-thumb-stage">
            <iframe
              className="creation-thumb-frame"
              srcDoc={buildSrcdoc(
                thread.experienceHtml!,
                thread.experienceCss!,
                thread.experienceJs!,
              )}
              sandbox="allow-scripts"
              loading="lazy"
              tabIndex={-1}
              title=""
            />
          </div>
        ) : (
          <div className="creation-thumb-empty">
            <span>No preview yet</span>
          </div>
        )}
      </div>
      <div className="creation-card-footer">
        <p className="creation-subtitle">{title}</p>
        {secondary ? <p className="creation-subtitle-secondary">{secondary}</p> : null}
      </div>
    </div>
  );
}

function threadCardDisplayTitle(thread: ThreadCard): string {
  const fromExperience = thread.experienceTitle?.trim();
  if (fromExperience) {
    return fromExperience;
  }
  const fromThread = thread.title?.trim();
  if (fromThread) {
    return fromThread;
  }
  return 'Untitled creation';
}

function threadCardSecondaryTitle(thread: ThreadCard): string | null {
  const exp = thread.experienceTitle?.trim();
  const raw = thread.title?.trim();
  if (!exp || !raw || raw === exp) {
    return null;
  }
  return raw;
}

function isThreadPreviewReady(thread: ThreadCard): boolean {
  return (
    typeof thread.experienceHtml === 'string' &&
    typeof thread.experienceCss === 'string' &&
    typeof thread.experienceJs === 'string'
  );
}
