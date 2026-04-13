export const DEMOS = [
  { slug: 'solar-system', label: 'Solar System' },
  { slug: 'pythagorean-theorem', label: 'Pythagorean Theorem' },
  { slug: 'projectile-motion', label: 'Projectile Motion' },
] as const;

export type DemoSlug = (typeof DEMOS)[number]['slug'];

export const STEP_REFINE_DEMO_SLUG = 'solar-system' as const;
export const STEP_SHARE_DEMO_SLUG = 'projectile-motion' as const;

export const STEP_PROMPT_EXAMPLES = [
  'Build an interactive tour of the solar system with a fact card for each planet.',
  'A projectile motion lab: angle and speed sliders, parabolic path, telemetry, and a random ground target with hit/miss feedback.',
  'A playful visual proof of the Pythagorean theorem students can manipulate.',
  'Gamified fraction practice: match diagrams to numbers, with gentle hints.',
] as const;

export const STEP_PROMPT_ROTATE_MS = 4800;

/** Step 2 refine visual: 0 empty canvas → 1 msg1 → 2 msg2 → 3 loading → 4 +msg3 → 5 iframe */
export type RefineAnimPhase = 0 | 1 | 2 | 3 | 4 | 5;

export const REFINE_PHASE_MS = {
  empty: 800,
  afterMsg1: 800,
  afterMsg2: 750,
  loadingBeforeMsg3: 750,
  loadingWithMsg3: 1000,
  holdIframe: 3600,
  beforeRepeat: 600,
} as const;
