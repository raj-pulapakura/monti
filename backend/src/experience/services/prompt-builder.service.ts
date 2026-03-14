import { Injectable } from '@nestjs/common';
import type {
  GenerateExperienceRequest,
  RefineExperienceRequest,
} from '../dto/experience.dto';

const BASE_CONSTRAINTS = [
  'Return JSON only.',
  'Include keys: title, description, html, css, js.',
  'Use no external libraries.',
  'Use no external network requests.',
  'Output must run in an iframe sandbox with allow-scripts only.',
  'Make interactions clear and immediate.',
  'Keep on-screen instructional text concise.',
].join('\n- ');

@Injectable()
export class PromptBuilderService {
  buildGenerationPrompt(request: GenerateExperienceRequest): string {
    const details: string[] = [
      `Topic request: ${request.prompt}`,
      request.format ? `Format: ${request.format}` : 'Format: auto-select best fit',
      request.audience ? `Audience: ${request.audience}` : 'Audience: general learner',
    ];

    return [
      'You are an educational interactive experience designer.',
      'Create a self-contained experience.',
      'Constraints:',
      `- ${BASE_CONSTRAINTS}`,
      '',
      'User request:',
      details.map((item) => `- ${item}`).join('\n'),
    ].join('\n');
  }

  buildRefinementPrompt(request: RefineExperienceRequest): string {
    return [
      'You are refining an existing educational interactive experience.',
      'Regenerate a complete replacement payload that preserves intent and applies requested edits.',
      'Constraints:',
      `- ${BASE_CONSTRAINTS}`,
      '',
      `Original request: ${request.originalPrompt}`,
      `Refinement instruction: ${request.refinementInstruction}`,
      'Previous experience payload:',
      JSON.stringify(request.priorExperience),
    ].join('\n');
  }
}
