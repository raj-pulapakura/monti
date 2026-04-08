import { parseGenerateExperienceToolArguments } from './generate-experience-tool.types';

describe('parseGenerateExperienceToolArguments', () => {
  it('ignores refine-only fields for generate operations', () => {
    const parsed = parseGenerateExperienceToolArguments({
      operation: 'generate',
      prompt: 'Build a solar system explainer',
      priorExperience: {
        title: '',
        description: '',
        html: '',
        css: '',
        js: '',
      },
      priorGenerationId: '',
      refinementInstruction: '',
    });

    expect(parsed).toEqual({
      operation: 'generate',
      prompt: 'Build a solar system explainer',
    });
  });

  it('requires refine fields when operation is refine', () => {
    expect(() =>
      parseGenerateExperienceToolArguments({
        operation: 'refine',
        prompt: 'Make it simpler',
      }),
    ).toThrow('refinementInstruction must be a string');
  });

  it('parses refine payload with only refinementInstruction (sandbox supplies prior)', () => {
    const parsed = parseGenerateExperienceToolArguments({
      operation: 'refine',
      prompt: 'Make it simpler',
      refinementInstruction: 'Use shorter sentences.',
    });

    expect(parsed).toEqual({
      operation: 'refine',
      prompt: 'Make it simpler',
      refinementInstruction: 'Use shorter sentences.',
    });
  });

  it('parses optional prior fields when the model includes them', () => {
    const parsed = parseGenerateExperienceToolArguments({
      operation: 'refine',
      prompt: 'Make it simpler',
      refinementInstruction: 'Use shorter sentences.',
      priorGenerationId: 'gen_123',
      priorExperience: {
        title: 'Solar System',
        description: 'An explainer',
        html: '<main></main>',
        css: 'main{}',
        js: 'console.log("ok")',
      },
    });

    expect(parsed.operation).toBe('refine');
    expect(parsed.priorGenerationId).toBe('gen_123');
    expect(parsed.priorExperience?.title).toBe('Solar System');
  });

  it('does not surface removed format or audience tool fields on generate', () => {
    const parsed = parseGenerateExperienceToolArguments({
      operation: 'generate',
      prompt: 'Build a statistics simulator',
      format: 'game',
      audience: 'university',
    });

    expect(parsed).toEqual({
      operation: 'generate',
      prompt: 'Build a statistics simulator',
    });
  });
});
