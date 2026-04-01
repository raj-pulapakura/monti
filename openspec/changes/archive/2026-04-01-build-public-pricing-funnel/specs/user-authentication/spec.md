## ADDED Requirements

### Requirement: Honor post-authentication redirect on sign-up
The sign-up flow SHALL read the `next` query parameter from the sign-up page URL and route the user to that path after successful authentication, consistent with the existing sign-in behavior. The `next` value MUST be validated with `resolveSafeNextPath` before use. If `next` is absent, invalid, or unsafe, the system MUST fall back to `/`. This requirement applies to both email/password sign-up and all OAuth sign-up paths.

#### Scenario: User arrives at sign-up with a next param and completes email sign-up
- **WHEN** a user signs up via email/password from `/auth/sign-up?next=/checkout/start` and authentication succeeds with an immediate session
- **THEN** the system routes the user to `/checkout/start` rather than the default home path

#### Scenario: User arrives at sign-up with a next param and completes OAuth sign-up
- **WHEN** a user chooses an OAuth provider from `/auth/sign-up?next=/checkout/start` and the OAuth callback succeeds
- **THEN** the system routes the user to `/checkout/start` rather than the default home path

#### Scenario: Sign-up next param is absent or unsafe
- **WHEN** a user signs up from `/auth/sign-up` with no `next` param, or with a `next` value that fails `resolveSafeNextPath` validation
- **THEN** the system routes to `/` after successful authentication
