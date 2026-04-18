import { BillingConfigService } from '../../billing/billing-config.service';
import { GenerateExperienceChatTool } from './generate-experience.chat-tool';
import type { GenerateExperienceToolService } from './generate-experience-tool.service';

describe('GenerateExperienceChatTool', () => {
  const billing = {
    launchCatalog: { fastCredits: 2, qualityCredits: 9 },
  } as Pick<BillingConfigService, 'launchCatalog'> as BillingConfigService;

  const generateExperienceTool = {} as GenerateExperienceToolService;

  it('requires confirmation for any arguments', () => {
    const tool = new GenerateExperienceChatTool(generateExperienceTool, billing);
    expect(tool.requiresConfirmation({})).toBe(true);
    expect(tool.requiresConfirmation({ operation: 'generate', prompt: 'x' })).toBe(true);
  });

  it('builds confirmation metadata from parsed operation and billing catalog', () => {
    const tool = new GenerateExperienceChatTool(generateExperienceTool, billing);
    expect(tool.getConfirmationMetadata({ operation: 'generate', prompt: 'hello' })).toEqual({
      operation: 'Generate experience',
      estimatedCredits: { fast: 2, quality: 9 },
    });
    expect(
      tool.getConfirmationMetadata({
        operation: 'refine',
        prompt: 'x',
        refinementInstruction: 'make it bigger',
      }),
    ).toEqual({
      operation: 'Refine experience',
      estimatedCredits: { fast: 2, quality: 9 },
    });
  });
});
