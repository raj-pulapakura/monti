import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  const service = new PromptBuilderService();

  it('builds a generation prompt with Monti philosophy, quality bar, and target guidance', () => {
    const prompt = service.buildGenerationPrompt({
      userId: 'user-1',
      prompt: 'Teach Bayes theorem through an interactive diagnostic simulator',
      format: 'game',
      audience: 'university',
      qualityMode: 'quality',
    });

    expect(prompt).toContain(
      'You are designing a Monti experience: a small, self-contained interactive learning experience that helps people understand something by engaging with it.',
    );
    expect(prompt).toContain('Monti philosophy:');
    expect(prompt).toContain(
      '- Center the experience on one idea and one strong core loop. Depth beats breadth.',
    );
    expect(prompt).toContain(
      '- Match the maturity, rigor, notation, and autonomy to the learner. Do not infantilize older learners or flatten advanced material.',
    );
    expect(prompt).toContain('Quality bar:');
    expect(prompt).toContain(
      '- The learner should be able to do something meaningful within seconds.',
    );
    expect(prompt).toContain(
      '- For complex domains, narrow the scope to one teachable slice and make that slice interactive.',
    );
    expect(prompt).toContain('Anti-patterns to avoid:');
    expect(prompt).toContain('Format guidance for game:');
    expect(prompt).toContain(
      '- The game loop should directly express the concept being taught rather than feeling pasted on.',
    );
    expect(prompt).toContain('Learner profile guidance for university:');
    expect(prompt).toContain(
      '- Treat the learner as capable of formal reasoning, domain terminology, and disciplined exploration.',
    );
    expect(prompt).toContain('Output contract:');
    expect(prompt).toContain('- Use no external network requests.');
    expect(prompt).toContain(
      '- Topic request: Teach Bayes theorem through an interactive diagnostic simulator',
    );
    expect(prompt).toContain('- Format: game');
    expect(prompt).toContain('- Learner profile: university');
  });

  it('builds generation prompts with auto-select and general-learner guidance when unset', () => {
    const prompt = service.buildGenerationPrompt({
      userId: 'user-1',
      prompt: 'Help me understand fractions',
      qualityMode: 'fast',
    });

    expect(prompt).toContain('Format selection guidance:');
    expect(prompt).toContain(
      '- Choose game when experimentation, strategy, or system dynamics are the best way to learn the concept.',
    );
    expect(prompt).toContain('Learner profile guidance for general learner:');
    expect(prompt).toContain(
      '- Use clear, concise language that is approachable without feeling childish.',
    );
    expect(prompt).toContain('- Format: auto-select the best fit');
    expect(prompt).toContain('- Learner profile: general learner');
  });

  it('builds a refinement prompt that preserves philosophy and adds anti-regression guidance', () => {
    const prompt = service.buildRefinementPrompt({
      userId: 'user-1',
      originalPrompt: 'Teach gravity with a small experiment',
      priorGenerationId: 'gen-1',
      refinementInstruction: 'Make the feedback more visual and reduce text.',
      priorExperience: {
        title: 'Gravity Lab',
        description: 'Explore falling objects.',
        html: '<main>Gravity</main>',
        css: 'main { color: black; }',
        js: 'console.log("gravity");',
      },
      qualityMode: 'quality',
    });

    expect(prompt).toContain('You are refining an existing Monti experience.');
    expect(prompt).toContain('Refinement goals:');
    expect(prompt).toContain(
      '- Avoid regressions in usability, focus, educational value, and completion arc.',
    );
    expect(prompt).toContain('Monti philosophy:');
    expect(prompt).toContain('Quality bar:');
    expect(prompt).toContain('Anti-patterns to avoid:');
    expect(prompt).toContain('Output contract:');
    expect(prompt).toContain('Original request: Teach gravity with a small experiment');
    expect(prompt).toContain(
      'Refinement instruction: Make the feedback more visual and reduce text.',
    );
    expect(prompt).toContain('"title":"Gravity Lab"');
    expect(prompt).toContain('"js":"console.log(\\"gravity\\");"');
  });
});
