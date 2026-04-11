## ADDED Requirements

### Requirement: Provide a shared AuthContext for client components
The system SHALL expose a React context (`AuthContext`) via an `AuthProvider` that wraps the app at the root layout level. The context SHALL expose the current Supabase `user` object, the current `session`, and a boolean `loading` flag.

#### Scenario: AuthProvider initializes on mount
- **WHEN** the app loads
- **THEN** `AuthProvider` calls `supabase.auth.getSession()` and sets `user` and `session` from the result; `loading` is `true` until resolution

#### Scenario: AuthProvider reflects auth state changes
- **WHEN** the user signs in or signs out
- **THEN** `AuthContext` updates `user` and `session` to reflect the new auth state within the same render cycle as the `onAuthStateChange` event

#### Scenario: Component reads user from context
- **WHEN** a client component calls `useAuthContext()`
- **THEN** it receives the current `{ user, session, loading }` without needing to manage its own Supabase subscription

### Requirement: Derive user display initials from auth context
The system SHALL expose a utility that derives display initials from a Supabase `User` object. For users with `user_metadata.full_name`, initials SHALL be the first character of each space-separated word (max two words, uppercased). For users without a full name, the initial SHALL be the first character of the email local part (before `@`), uppercased.

#### Scenario: Google OAuth user initials
- **WHEN** `user.user_metadata.full_name` is "John Doe"
- **THEN** the derived initials are "JD"

#### Scenario: Single-name Google OAuth user
- **WHEN** `user.user_metadata.full_name` is "Cher"
- **THEN** the derived initials are "C"

#### Scenario: Email/password user initials
- **WHEN** `user.user_metadata.full_name` is absent and `user.email` is "raj@example.com"
- **THEN** the derived initials are "R"
