## Why

Users have no sense of their own identity in the app — there's no visible indication of who they're signed in as, and no unified place to manage their account. The existing profile dropdown is minimal and the billing page lives in isolation with no settings context around it.

## What Changes

- Replace the "Profile" dropdown button in `AppTopbar` and `FloatingProfileControls` with an initials-circle avatar button that shows the user's initials (e.g. "JD" for John Doe)
- Clicking the initials button opens a minimal popover with two actions: **Settings** (navigates to `/settings`) and **Sign out**
- Introduce a `/settings` hub page with a sidebar nav and two sub-pages: `/settings/account` and `/settings/billing`
- `/settings/account` displays the user's email, auth provider, and account information (read-only for now)
- `/settings/billing` receives the existing billing page content (currently at `/billing`)
- `/billing` redirects permanently to `/settings/billing`
- Add a shared `AuthContext` so any component (including `AppTopbar`) can access the current user's identity without prop-drilling

## Capabilities

### New Capabilities

- `settings-hub`: Settings page shell at `/settings` with sidebar navigation linking to Account and Billing sub-pages
- `account-settings`: `/settings/account` sub-page showing user identity (email, auth provider)
- `user-auth-context`: Client-side React context that exposes the current Supabase user and session, consumed by topbar and settings pages

### Modified Capabilities

- `user-authentication`: Nav surfaces now show user identity via initials circle; sign-out moves from dropdown to settings popover
- `billing-dashboard-layout`: Billing content moves from `/billing` to `/settings/billing`; `/billing` becomes a redirect

## Impact

- **`app/components/app-topbar.tsx`**: Replace profile dropdown with initials-circle button + minimal popover
- **`app/components/floating-profile-controls.tsx`**: Same popover change as topbar
- **`app/layout.tsx`**: Wrap children in new `AuthProvider`
- **New files**: `app/context/auth-context.tsx`, `app/settings/layout.tsx`, `app/settings/page.tsx`, `app/settings/account/page.tsx`, `app/settings/billing/page.tsx`
- **`app/billing/page.tsx`**: Convert to redirect → `/settings/billing`
- **`app/globals.css`**: New styles for initials circle, settings sidebar, settings layout
- No API changes; billing API calls move to the new route but are otherwise unchanged
