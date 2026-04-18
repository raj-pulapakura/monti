export type GenerationMode = 'fast' | 'quality';

export type GenerationModeOption = {
  value: GenerationMode;
  label: string;
  /** Shown in the confirmation gate info control (hover / keyboard focus). */
  tooltip: string;
};

export const GENERATION_MODE_OPTIONS: GenerationModeOption[] = [
  {
    value: 'fast',
    label: 'Draft',
    tooltip:
      'Uses fewer credits. Best for early drafts, quick iterations or a lighter preview before committing to a full-quality pass. Typically takes 1-2 minutes.',
  },
  {
    value: 'quality',
    label: 'High quality',
    tooltip:
      'Uses more credits for a richer, more polished result, best for experiences that require a high level of detail and complexity. Typically takes 5 minutes.',
  },
];

export function isGenerationMode(value: unknown): value is GenerationMode {
  return value === 'fast' || value === 'quality';
}

export function generationModeMenuLabel(mode: GenerationMode): string {
  const opt = GENERATION_MODE_OPTIONS.find((o) => o.value === mode);
  return opt?.label ?? mode;
}
