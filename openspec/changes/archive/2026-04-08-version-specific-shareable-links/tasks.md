## 1. Backend — versioned play endpoint

- [x] 1.1 Extend `ExperiencePlayRepository.findBySlug(slug, versionNumber?)` — when `versionNumber` is provided, query `experience_versions` by `experience_id + version_number` where `generation_status = 'succeeded'` instead of using `latest_version_id`
- [x] 1.2 Add `@Query('v')` integer param to `ExperiencePlayController.getBySlug()` — parse with `parseInt`, return 400 on non-integer, pass to repository when valid
- [x] 1.3 Add unit test for `findBySlug` with version number: succeeds, version not found (404), non-succeeded version not served

## 2. Frontend — play page version param

- [x] 2.1 In `play-client.tsx`, read `?v=` from URL with `useSearchParams()` and append to the `/api/play/:slug` fetch URL when present
- [x] 2.2 In `play/[slug]/page.tsx`, accept `searchParams` as a server prop and pass `v` through to `fetchExperienceTitle()` so metadata resolves correctly for versioned links

## 3. Frontend — version-aware copy link

- [x] 3.1 In `handleCopyLink()` (`page.tsx:843`), detect whether the viewed version is the latest: compare `viewingVersionId` to `versionList[versionList.length - 1]?.id` (treat `null` as latest)
- [x] 3.2 When viewing a non-latest version, build `{origin}/play/{slug}?v={viewingVersionNumber}` instead of the unversioned URL
- [x] 3.3 Update the copy-link button tooltip to read "Copy link to v*N*" when `viewingVersionId` is pinned to a non-latest version, and "Copy link" otherwise
