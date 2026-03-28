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

const FORMAT_AUTO_SELECTION_RULES = [
  'Choose quiz when repeated retrieval, comparison, or step-by-step reasoning practice best teaches the idea.',
  'Choose game when experimentation, strategy, or system dynamics are the best way to learn the concept.',
  'Choose explainer when guided manipulation, visualization, or direct cause-and-effect exploration best teaches the idea.',
  'Do not choose a format that turns the experience into mostly reading.',
];

const FORMAT_GUIDANCE: Record<'quiz' | 'game' | 'explainer', string[]> = {
  quiz: [
    'Make the learner think, predict, compare, or reason instead of recalling trivia only.',
    'Each interaction should teach through feedback, hints, examples, or visible state changes.',
    'Avoid plain right-or-wrong answer checking with no explanation.',
  ],
  game: [
    'Make the learner manipulate a system, experiment, and discover patterns through play.',
    'The game loop should directly express the concept being taught rather than feeling pasted on.',
    'Use progress, challenge, and feedback to reinforce understanding.',
  ],
  explainer: [
    'Teach through guided manipulation, visualization, and direct cause-and-effect exploration.',
    'Keep exposition short and subordinate to interaction.',
    'Do not turn the experience into a static article with a few buttons.',
  ],
};

const AUDIENCE_GUIDANCE: Record<
  | 'young-kids'
  | 'elementary'
  | 'middle-school'
  | 'high-school'
  | 'university'
  | 'adult'
  | 'general',
  string[]
> = {
  'young-kids': [
    'Use very simple language, short instructions, large interactive targets, and obvious visual feedback.',
    'Keep the tone playful and warm, but still focused on one clear learning goal.',
  ],
  elementary: [
    'Use concrete language, short chunks of text, scaffolded challenge, and visible progress.',
    'Balance playfulness with clear guidance and strong feedback.',
  ],
  'middle-school': [
    'Allow more autonomy, richer systems, and stronger problem-solving without sounding childish.',
    'Keep the interaction engaging and respectful of the learner.',
  ],
  'high-school': [
    'Use mature, direct language and allow multi-step reasoning, stronger autonomy, and more precise models.',
    'Introduce abstraction or notation when it helps, but keep the interaction legible and purposeful.',
  ],
  university: [
    'Treat the learner as capable of formal reasoning, domain terminology, and disciplined exploration.',
    'Use precise language, notation, and rigor when appropriate, but scope the topic to one interactive, teachable slice.',
  ],
  adult: [
    'Use mature, respectful language and assume the learner values efficiency, clarity, and substance over hand-holding.',
    'Do not oversimplify the topic; make the interaction focused, self-explanatory, and genuinely informative.',
  ],
  general: [
    'Use clear, concise language that is approachable without feeling childish.',
    'Assume curiosity, not prior expertise, unless the prompt suggests otherwise.',
  ],
};

@Injectable()
export class PromptBuilderService {
  buildGenerationPrompt(request: GenerateExperienceRequest): string {
    const details: string[] = [
      `Topic request: ${request.prompt}`,
      request.format ? `Format: ${request.format}` : 'Format: auto-select the best fit',
      request.audience
        ? `Learner profile: ${request.audience}`
        : 'Learner profile: general learner',
    ];

    return [
      'You are designing a Monti experience: a small, self-contained interactive learning experience that helps people understand something by engaging with it.',
      'Create a compact interactive model of an idea, not a content page that happens to have buttons.',
      '',
      renderBulletSection('Monti philosophy', MONTI_PHILOSOPHY),
      '',
      renderBulletSection('Quality bar', QUALITY_BAR),
      '',
      renderBulletSection('Anti-patterns to avoid', ANTI_PATTERNS),
      '',
      request.format
        ? renderBulletSection(
            `Format guidance for ${request.format}`,
            FORMAT_GUIDANCE[request.format],
          )
        : renderBulletSection(
            'Format selection guidance',
            FORMAT_AUTO_SELECTION_RULES,
          ),
      '',
      renderBulletSection(
        `Learner profile guidance for ${request.audience ?? 'general learner'}`,
        resolveAudienceGuidance(request.audience),
      ),
      '',
      renderBulletSection('Output contract', OUTPUT_CONTRACT),
      '',
      'User request:',
      details.map((item) => `- ${item}`).join('\n'),
    ].join('\n');
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

function resolveAudienceGuidance(
  audience: GenerateExperienceRequest['audience'],
): string[] {
  if (!audience) {
    return AUDIENCE_GUIDANCE.general;
  }

  return AUDIENCE_GUIDANCE[audience];
}
