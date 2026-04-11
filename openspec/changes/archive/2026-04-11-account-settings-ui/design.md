## Context

The app currently has two nav components (`AppTopbar`, `FloatingProfileControls`) that both render a "Profile" dropdown with Billing & Plan and Sign out options. Neither surface shows any user identity. User data (session, access token) is managed locally in each page component with no shared context — pages call `supabase.auth.getSession()` independently.

The billing page lives at `/billing` as a standalone route with its own topbar instance.

## Goals / Non-Goals

**Goals:**
- Surface user identity (initials circle) in the topbar on all authenticated pages
- Provide a unified `/settings` hub replacing ad-hoc access to billing
- Add an `AuthContext` to share user/session state without prop-drilling
- Redirect `/billing` → `/settings/billing` so existing links don't break

**Non-Goals:**
- Redesigning billing sub-page UI (content stays as-is, just relocated)
- Editable account fields (account page is read-only for now)
- Server-side auth context or middleware changes

## Decisions

### Decision: React context for auth state

**Choice**: Add `AuthProvider` at `app/layout.tsx` (client component wrapper) that calls `supabase.auth.getUser()` and subscribes to `onAuthStateChange`. Exposes `{ user, session, loading }`.

**Alternatives considered**:
- Continue prop-drilling from each page → doesn't scale, topbar currently receives no user data at all
- Server component with cookie-based session → requires RSC refactor across all pages; too disruptive

**Rationale**: Minimal change surface. Pages already initialize supabase browser client; context just centralizes the subscription.

### Decision: Initials derivation strategy

**Choice**:
1. If `user.user_metadata.full_name` exists (Google OAuth) → split on space, take first char of each word (max 2), uppercase
2. Else fall back to `user.email` → take first char of local part (before `@`), uppercase

**Rationale**: Google always provides `full_name` in metadata. Email/password users have no name data; single-char initial is unambiguous.

### Decision: Settings layout as a nested Next.js layout

**Choice**: `app/settings/layout.tsx` renders the sidebar + `{children}` outlet. Sub-pages `account/page.tsx` and `billing/page.tsx` slot in as children.

**Alternatives considered**:
- Single settings page with tab state → URL doesn't reflect active section; deep-linking breaks
- Separate top-level routes with duplicated sidebar → harder to keep consistent

**Rationale**: Next.js nested layouts are the idiomatic pattern; sidebar renders once, sub-page content swaps.

### Decision: `/billing` redirect

**Choice**: `app/billing/page.tsx` becomes a Next.js `redirect('/settings/billing')` (permanent, 308).

**Rationale**: Stripe checkout return URLs and any existing bookmarks will auto-follow. No dead links.

### Decision: Popover vs modal for topbar menu

**Choice**: Keep the existing `useDropdownMenu` hook pattern for the minimal popover (Settings / Sign out). Same click-outside-to-close behavior as the current dropdown.

**Rationale**: Zero new dependencies, pattern already proven in the codebase.

## Risks / Trade-offs

- **AuthContext double-subscription**: Pages that currently call `onAuthStateChange` themselves will have two listeners. → Each page can drop its own subscription once context is available; migrate pages incrementally.
- **Settings sidebar on mobile**: Sidebar must collapse gracefully on small screens. → Use responsive CSS; sidebar stacks above content on mobile.
- **Return URL in billing portal**: `openPortal` passes `window.location.origin + '/billing'` as returnUrl — this will now 308-redirect correctly, but worth noting.

## Migration Plan

1. Add `AuthProvider` + `AuthContext` — no visible change yet
2. Update `AppTopbar` and `FloatingProfileControls` to consume context and render initials circle + new popover
3. Add `/settings` layout and sub-pages; wire billing content into `/settings/billing`
4. Convert `app/billing/page.tsx` to a redirect
5. Test: sign in via Google (two initials), sign in via email (one initial), settings nav, billing redirect
