export type GenerationMode = 'fast' | 'quality';

export const GENERATION_MODE_OPTIONS: Array<{
  value: GenerationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'fast',
    label: 'Draft',
    description: 'Lower credit cost',
  },
  {
    value: 'quality',
    label: 'High quality',
    description: 'Best result',
  },
];

export function isGenerationMode(value: unknown): value is GenerationMode {
  return value === 'fast' || value === 'quality';
}

export function generationModeMenuLabel(mode: GenerationMode): string {
  const opt = GENERATION_MODE_OPTIONS.find((o) => o.value === mode);
  return opt?.label ?? mode;
}
