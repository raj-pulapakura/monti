/**
 * Allowlist for `/play/demo/[demoSlug]`: each slug must have `public/demos/{slug}.html`.
 * Include every `DEMOS` slug plus any step-only demo (e.g. `STEP_SHARE_DEMO_SLUG`).
 */
const PUBLIC_PLAY_DEMO_SLUGS = new Set([
  'solar-system',
  'pythagorean-theorem',
  'animal-cell',
  'projectile-motion',
]);

export function isPublicPlayDemoSlug(slug: string): boolean {
  return PUBLIC_PLAY_DEMO_SLUGS.has(slug);
}
