export type GenerationMode = 'auto' | 'fast' | 'quality';

export const GENERATION_MODE_OPTIONS: Array<{
  value: GenerationMode;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Let Monti choose',
  },
  {
    value: 'fast',
    label: 'Fast',
    description: 'Lower latency',
  },
  {
    value: 'quality',
    label: 'Quality',
    description: 'Best result',
  },
];

export function isGenerationMode(value: unknown): value is GenerationMode {
  return value === 'auto' || value === 'fast' || value === 'quality';
}
