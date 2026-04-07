## 1. Backend — Slug Generation

- [x] 1.1 Add `generateExperienceSlug(title)` helper to `experience-persistence.repository.ts` using `crypto.randomBytes(3).toString('hex')` suffix and title slugification capped at 40 chars
- [x] 1.2 Update `createExperience()` in `ExperiencePersistenceRepository` to generate and insert `slug` on new experience records

## 2. Backend — Public Play Endpoint

- [x] 2.1 Create `ExperiencePlayRepository` in `backend/src/experience/services/` injecting `SUPABASE_ADMIN_CLIENT`; implement `findBySlug(slug)` querying `experiences` → `experience_versions` for `title, html, css, js`
- [x] 2.2 Create `ExperiencePlayController` at `backend/src/experience/experience-play.controller.ts` with `GET /api/play/:slug`, no auth guard, returning 404 on miss
- [x] 2.3 Add `SupabaseModule`, `ExperiencePlayController`, and `ExperiencePlayRepository` to `ExperienceModule` imports/controllers/providers

## 3. Backend — Slug in Sandbox Preview

- [x] 3.1 Update `getSandboxPreview()` in `ChatRuntimeRepository` to fetch `slug` from `experiences` in parallel with the version query using `sandboxState.experience_id`
- [x] 3.2 Update return type in `ChatRuntimeRepository.getSandboxPreview()` and `ChatRuntimeService.getSandboxPreview()` to include `slug: string | null` on `activeExperience`

## 4. Frontend — Public Play Page

- [x] 4.1 Create `web/app/play/[slug]/page.tsx` — implemented as a **client component** (not server component) to avoid Docker container networking issues with server-side fetch
- [x] 4.2 Add `generateMetadata` export to set the page `<title>` from the experience title — implemented via server wrapper `page.tsx` + `play-client.tsx` split; uses `API_INTERNAL_URL` env var (`http://backend:3001` in Docker, `http://localhost:3001` locally)
- [x] 4.3 Add "Made with Monti" footer strip below the iframe with a link back to the home page

## 5. Frontend — Copy Link Button

- [x] 5.1 Add `slug: string | null` to the `ExperiencePayload` type in `web/app/chat/[threadId]/page.tsx`
- [x] 5.2 Add `linkCopied` boolean state; implement `handleCopyLink()` that writes `{origin}/play/{slug}` to clipboard and sets `linkCopied` for 2 seconds
- [x] 5.3 Add copy-link button (`Link2` icon → `Check` icon on success) to sandbox header actions, visible only when `activeExperience.slug` is non-null
- [x] 5.4 Reset `linkCopied` state in the thread-change cleanup effect
