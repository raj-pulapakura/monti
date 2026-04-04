/**
 * Example prompts for the authenticated home create flow.
 * Which three appear is deterministic per Supabase user id and UTC calendar day
 * (stable across refreshes; rotates at UTC midnight).
 *
 * Prompts skew toward classroom-ready interactive visualizers—minimal on-screen
 * text, strong illustration, one clear concept. Each entry includes a default
 * generation mode (auto / fast / quality) applied when the chip is chosen.
 */

import type { GenerationMode } from "@/lib/chat/generation-mode";

export type HomeExamplePrompt = {
  /** Decorative; not read by the button’s `aria-label` (prompt text is). */
  readonly emoji: string;
  readonly prompt: string;
  readonly generationMode: GenerationMode;
};

/** 32-bit FNV-1a — deterministic, fast, good enough for UI rotation. */
export function fnv1a32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** `YYYY-MM-DD` in UTC, e.g. for seeding. */
export function utcCalendarDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const EXAMPLE_PROMPT_POOL: readonly HomeExamplePrompt[] = [
  {
    emoji: "🪐",
    generationMode: "quality",
    prompt:
      "Build a beautiful interactive solar system visualizer—orbits you can scrub or follow, minimal labels, gorgeous planetary illustration and lighting. For teaching scale and motion in a planetarium-style way.",
  },
  {
    emoji: "🧬",
    generationMode: "quality",
    prompt:
      "Build a stunning interactive animal cell explorer: tap organelles for a short highlight, painterly visuals, almost no paragraphs on screen. High school biology, projection-friendly.",
  },
  {
    emoji: "🌍",
    generationMode: "auto",
    prompt:
      "Interactive world map of plate boundaries—drag time or a slider to see ridges, trenches, and mountain belts emerge with restrained labels. Middle school earth science, visual-first.",
  },
  {
    emoji: "📐",
    generationMode: "fast",
    prompt:
      "Clean unit circle: draggable angle, sine and cosine as live segment lengths on the axes—sparse notation, high contrast, minimal chrome. For trig introduction on a projector.",
  },
  {
    emoji: "⚛️",
    generationMode: "auto",
    prompt:
      "Bohr-style atom builder: place electrons in shells with gentle feedback when a shell is wrong—soft gradients, tiny captions only. Middle school chemistry, one screen.",
  },
  {
    emoji: "❤️",
    generationMode: "quality",
    prompt:
      "A single looping diagram of heart and lungs—blood shifts hue with oxygen, flow animates in a calm loop, almost no wall of text. Upper elementary or middle school circulation.",
  },
  {
    emoji: "🌊",
    generationMode: "fast",
    prompt:
      "Two-source ripple tank: drag spacing and phase, watch constructive and destructive interference—dark water, bright crests, minimal UI copy. Wave unit, quick to grasp.",
  },
  {
    emoji: "📈",
    generationMode: "auto",
    prompt:
      "Elegant supply and demand: draggable curves, equilibrium clears with a clear marker and optional quantity readout—microeconomics intro, almost no essay text on the page.",
  },
  {
    emoji: "🦕",
    generationMode: "quality",
    prompt:
      "Scrollable deep-time timeline from Earth’s formation to now—illustrated eras, zoomable bands, era names only where needed. Earth history for secondary students, museum-poster energy.",
  },
  {
    emoji: "🔺",
    generationMode: "fast",
    prompt:
      "Interactive Pythagorean proof: rearrange colored tiles on a square to show a² + b² = c²—one satisfying ‘click’ moment, geometry class, almost no words.",
  },
  {
    emoji: "🌤️",
    generationMode: "auto",
    prompt:
      "Vertical slice through atmosphere layers—scroll to move altitude, temperature as color, sparse labels (troposphere through exosphere). Weather or climate intro, calm infographic style.",
  },
  {
    emoji: "🌙",
    generationMode: "fast",
    prompt:
      "Moon-phase dial with Sun–Earth–Moon geometry and a lit hemisphere you rotate—starry backdrop, minimal captions. Middle school space science, beautiful and immediate.",
  },
];

export function pickHomeExamplePrompts(input: {
  userId: string;
  now: Date;
}): readonly [HomeExamplePrompt, HomeExamplePrompt, HomeExamplePrompt] {
  const pool = EXAMPLE_PROMPT_POOL;
  const n = pool.length;
  if (n < 3) {
    throw new Error("EXAMPLE_PROMPT_POOL must contain at least three prompts");
  }

  const day = utcCalendarDateKey(input.now);
  const seed = fnv1a32(`${input.userId}:${day}`);
  const start = seed % n;

  return [
    pool[start]!,
    pool[(start + 1) % n]!,
    pool[(start + 2) % n]!,
  ];
}

/** Short label for chip UI; full prompt still applied on click. */
export function examplePromptChipLabel(full: string, maxChars = 72): string {
  const t = full.trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, maxChars - 1).trimEnd()}…`;
}
