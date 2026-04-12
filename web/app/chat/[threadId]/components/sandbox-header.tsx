'use client';

import { Check, ChevronLeft, ChevronRight, Expand, Link2, Pencil, Star, X } from 'lucide-react';
import { useRef } from 'react';

type VersionMeta = {
  id: string;
  versionNumber: number;
  promptSummary: string;
};

type ExperiencePayload = {
  title: string;
  slug: string | null;
  isFavourite: boolean;
};

export function SandboxHeader(input: {
  activeExperience: ExperiencePayload | null;
  versionList: VersionMeta[];
  viewingVersionIndex: number;
  viewingVersionNumber: number | null;
  isEditingTitle: boolean;
  titleDraft: string;
  titleEditPending: boolean;
  titleEditError: string | null;
  fullscreenErrorMessage: string | null;
  favouriteActionError: string | null;
  favouriteTogglePending: boolean;
  linkCopied: boolean;
  isViewingLatest: boolean;
  onTitleDraftChange: (value: string) => void;
  onTitleSave: () => void;
  onTitleCancel: () => void;
  onEditTitleStart: () => void;
  onVersionPrev: () => void;
  onVersionNext: () => void;
  onFavouriteToggle: () => void;
  onCopyLink: () => void;
  onEnterFullscreen: () => void;
}) {
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const showVersionNav = input.versionList.length > 1 && input.viewingVersionNumber !== null;
  const showFavourite = Boolean(input.activeExperience);
  const showLink = Boolean(input.activeExperience?.slug);
  const showFullscreen = Boolean(input.activeExperience);

  return (
    <div className="sandbox-header">
      <div className="sandbox-header-copy">
        {input.activeExperience ? (
          <div
            className={
              input.isEditingTitle
                ? 'sandbox-title-row sandbox-title-row--edit'
                : 'sandbox-title-row'
            }
          >
            {input.isEditingTitle ? (
              <>
                <input
                  ref={titleInputRef}
                  className="sandbox-title-input"
                  value={input.titleDraft}
                  onChange={(event) => input.onTitleDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      input.onTitleSave();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      input.onTitleCancel();
                    }
                  }}
                  disabled={input.titleEditPending}
                  aria-label="Edit experience title"
                />
                <div className="sandbox-title-edit-actions">
                  <button
                    type="button"
                    className="sandbox-title-icon-action"
                    onClick={input.onTitleSave}
                    disabled={input.titleEditPending || input.titleDraft.trim().length === 0}
                    aria-label="Save title"
                    title="Save title"
                  >
                    <Check size={16} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="sandbox-title-icon-action"
                    onClick={input.onTitleCancel}
                    disabled={input.titleEditPending}
                    aria-label="Cancel title edit"
                    title="Cancel"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="sandbox-title-heading">{input.activeExperience.title}</h2>
                <button
                  type="button"
                  className="sandbox-title-icon-action"
                  onClick={input.onEditTitleStart}
                  aria-label="Edit experience title"
                  title="Edit title"
                >
                  <Pencil size={14} strokeWidth={2} />
                </button>
              </>
            )}
          </div>
        ) : (
          <h2>Experience</h2>
        )}
        {input.titleEditError ? (
          <p className="sandbox-header-note is-error" role="status" aria-live="polite">
            {input.titleEditError}
          </p>
        ) : null}
        {input.fullscreenErrorMessage ? (
          <p className="sandbox-header-note is-error" role="status" aria-live="polite">
            {input.fullscreenErrorMessage}
          </p>
        ) : null}
        {input.favouriteActionError ? (
          <p className="sandbox-header-note is-error" role="status" aria-live="polite">
            {input.favouriteActionError}
          </p>
        ) : null}
      </div>
      <div className="sandbox-header-actions">
        {showVersionNav ? (
          <div
            className="sandbox-version-nav"
            aria-label="Version navigation"
            title={input.versionList[input.viewingVersionIndex]?.promptSummary ?? ''}
          >
            <button
              type="button"
              className="sandbox-version-chevron"
              disabled={input.viewingVersionIndex <= 0}
              onClick={input.onVersionPrev}
              aria-label="Previous version"
            >
              <ChevronLeft size={13} strokeWidth={2.5} />
            </button>
            <span className="sandbox-version-label">
              v{input.viewingVersionNumber}{' '}
              <span className="sandbox-version-total">/ {input.versionList.length}</span>
            </span>
            <button
              type="button"
              className="sandbox-version-chevron"
              disabled={input.viewingVersionIndex >= input.versionList.length - 1}
              onClick={input.onVersionNext}
              aria-label="Next version"
            >
              <ChevronRight size={13} strokeWidth={2.5} />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={`sandbox-control-button${input.activeExperience?.isFavourite ? ' is-favourited-star' : ''}`}
          onClick={input.onFavouriteToggle}
          disabled={input.favouriteTogglePending || !showFavourite}
          aria-label={
            input.activeExperience?.isFavourite
              ? 'Remove from favourites'
              : 'Add to favourites'
          }
          title={
            input.activeExperience?.isFavourite
              ? 'Remove from favourites'
              : 'Add to favourites'
          }
        >
          <Star size={17} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          className="sandbox-control-button"
          onClick={input.onCopyLink}
          disabled={!showLink}
          aria-label={
            input.linkCopied
              ? 'Link copied'
              : !input.isViewingLatest && input.viewingVersionNumber !== null
                ? `Copy link to v${input.viewingVersionNumber}`
                : 'Copy link'
          }
          title={
            input.linkCopied
              ? 'Link copied!'
              : !input.isViewingLatest && input.viewingVersionNumber !== null
                ? `Copy link to v${input.viewingVersionNumber}`
                : 'Copy link'
          }
        >
          {input.linkCopied ? (
            <Check size={17} strokeWidth={2.2} />
          ) : (
            <Link2 size={17} strokeWidth={2.2} />
          )}
        </button>
        <button
          type="button"
          className="sandbox-control-button"
          onClick={input.onEnterFullscreen}
          disabled={!showFullscreen}
          aria-label="View experience fullscreen"
          title="View experience fullscreen"
        >
          <Expand size={17} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
