## 1. Auth Context

- [x] 1.1 Create `app/context/auth-context.tsx` — `AuthProvider` component that calls `supabase.auth.getSession()` on mount, subscribes to `onAuthStateChange`, and exposes `{ user, session, loading }` via context
- [x] 1.2 Create `useAuthContext()` hook in the same file
- [x] 1.3 Create `lib/auth/derive-initials.ts` — pure utility that derives initials from a Supabase `User` (full_name → "JD", email fallback → "R")
- [x] 1.4 Wrap `app/layout.tsx` children in `<AuthProvider>`

## 2. Topbar — Initials Circle + Popover

- [x] 2.1 Update `AppTopbar` to consume `useAuthContext()` and derive initials; replace "Profile" button with initials-circle button
- [x] 2.2 Replace the dropdown items in `AppTopbar` with two items: "Settings" (link to `/settings`) and "Sign out"
- [x] 2.3 Apply same changes to `FloatingProfileControls`
- [x] 2.4 Add CSS for initials-circle button (size, background, font) and update/trim any dead profile-button styles in `globals.css`

## 3. Settings Hub Layout

- [x] 3.1 Create `app/settings/layout.tsx` — renders `AppTopbar` + two-column shell (sidebar + `{children}` outlet); sidebar has Account and Billing nav links; highlights active link via `usePathname()`
- [x] 3.2 Create `app/settings/page.tsx` — redirects to `/settings/account`
- [x] 3.3 Add CSS for settings layout: sidebar, content area, active link state, mobile responsive collapse

## 4. Account Sub-page

- [x] 4.1 Create `app/settings/account/page.tsx` — reads user from `useAuthContext()`, displays email and auth provider (Google vs email/password) as read-only fields

## 5. Billing Sub-page

- [x] 5.1 Create `app/settings/billing/page.tsx` — move billing page logic and JSX from `app/billing/page.tsx` into this new file; update any hardcoded `/billing` return URLs to `/settings/billing`
- [x] 5.2 Convert `app/billing/page.tsx` to a permanent redirect (`redirect('/settings/billing')`) — remove all existing logic

## 6. Auth Guard

- [x] 6.1 Add auth guard to `app/settings/layout.tsx` — redirect unauthenticated users to `/sign-in?next=<current path>`

## 7. Verification

- [x] 7.1 Sign in via Google — verify two-char initials appear in topbar
- [x] 7.2 Sign in via email/password — verify single-char initial appears in topbar
- [x] 7.3 Click initials → popover shows Settings + Sign out only
- [x] 7.4 Navigate to `/settings` → redirects to `/settings/account` → account info visible
- [x] 7.5 Navigate to `/settings/billing` → billing content renders correctly
- [x] 7.6 Navigate to `/billing` → permanent redirect to `/settings/billing` works
- [x] 7.7 Unauthenticated visit to `/settings/account` → redirects to sign-in
