import { Injectable } from '@nestjs/common';
import type {
  GenerateExperienceRequest,
  RefineExperienceRequest,
} from '../dto/experience.dto';

const MONTI_PHILOSOPHY = [
  'Learning happens through interaction. The learner should understand by doing, testing, and observing.',
  'Center the experience on one idea and one strong core loop. Depth beats breadth.',
  'Feedback is the teaching layer. Show why something changed, not only whether it was right or wrong.',
  'Simplify reality without distorting it.',
  'Match the maturity, rigor, notation, and autonomy to the learner. Do not infantilize older learners or flatten advanced material.',
  'Favor clarity before cleverness.',
  'Make the experience finishable, robust, and focused.',
];

const QUALITY_BAR = [
  'The learner should be able to do something meaningful within seconds.',
  'Use one strong interactive mechanic executed well.',
  'Keep on-screen text concise and high-signal.',
  'Give immediate, visible cause-and-effect feedback.',
  'Create a clear beginning, progression, and payoff.',
  'The result should feel intentionally designed, polished, and worth completing.',
  'For complex domains, narrow the scope to one teachable slice and make that slice interactive.',
  'Prefer robust interactions over technically ambitious but brittle ones.',
];

const ANTI_PATTERNS = [
  'A static explainer with a few decorative buttons.',
  'A quiz shell that only checks answers without teaching through feedback.',
  'Multiple weak mechanics competing for attention.',
  'Long setup or long instructions before the first meaningful interaction.',
  'A flashy interface with weak educational value.',
  'An ambitious simulation that becomes confusing or fragile.',
];

const OUTPUT_CONTRACT = [
  'Return JSON only.',
  'Include keys: title, description, html, css, js.',
  'Use no external libraries.',
  'Use no external network requests.',
  'Output must run in an iframe sandbox with allow-scripts only.',
  'Keep html, css, and js self-contained.',
  'Use semantic and accessible HTML where practical.',
  'Make interactions clear and immediate.',
  'Keep on-screen instructional text concise.',
];

@Injectable()
export class PromptBuilderService {
  buildGenerationPrompt(request: GenerateExperienceRequest): string {
    const prompt = [
      'You are designing a Monti experience: a small, self-contained interactive learning experience that helps people understand something by engaging with it.',
      'Create a compact interactive model of an idea, not a content page that happens to have buttons.',
      '',
      renderBulletSection('Monti philosophy', MONTI_PHILOSOPHY),
      '',
      renderBulletSection('Quality bar', QUALITY_BAR),
      '',
      renderBulletSection('Anti-patterns to avoid', ANTI_PATTERNS),
      '',
      renderBulletSection('Output contract', OUTPUT_CONTRACT),
      '',
      'User request:',
      `- Topic request: ${request.prompt}`,
    ].join('\n');

    return prompt;
  }

  buildRefinementPrompt(request: RefineExperienceRequest): string {
    return [
      'You are refining an existing Monti experience.',
      'Regenerate a complete replacement payload that preserves intent and applies the requested edits.',
      '',
      renderBulletSection('Refinement goals', [
        'Keep the core learning goal unless the instruction explicitly changes it.',
        'Preserve the strongest parts of the prior experience when they still support the goal.',
        'Improve interaction, feedback, clarity, and polish rather than only rewriting text.',
        'Avoid regressions in usability, focus, educational value, and completion arc.',
      ]),
      '',
      renderBulletSection('Monti philosophy', MONTI_PHILOSOPHY),
      '',
      renderBulletSection('Quality bar', QUALITY_BAR),
      '',
      renderBulletSection('Anti-patterns to avoid', ANTI_PATTERNS),
      '',
      renderBulletSection('Output contract', OUTPUT_CONTRACT),
      '',
      `Original request: ${request.originalPrompt}`,
      `Refinement instruction: ${request.refinementInstruction}`,
      'Previous experience payload:',
      JSON.stringify(request.priorExperience),
    ].join('\n');
  }
}

function renderBulletSection(title: string, items: string[]): string {
  return [title + ':', ...items.map((item) => `- ${item}`)].join('\n');
}
