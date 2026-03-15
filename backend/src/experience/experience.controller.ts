import { Body, Controller, Post } from '@nestjs/common';
import { ValidationError } from '../common/errors/app-error';
import {
  parseGenerateExperienceRequest,
  parseRefineExperienceRequest,
} from './dto/experience.dto';
import { ExperienceOrchestratorService } from './services/experience-orchestrator.service';

@Controller('api/experiences')
export class ExperienceController {
  constructor(private readonly orchestrator: ExperienceOrchestratorService) {}

  @Post('generate')
  async generate(@Body() body: unknown) {
    assertLegacyExperienceApiEnabled();
    const request = parseGenerateExperienceRequest(body);
    const payload = await this.orchestrator.generate(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Post('refine')
  async refine(@Body() body: unknown) {
    assertLegacyExperienceApiEnabled();
    const request = parseRefineExperienceRequest(body);
    const payload = await this.orchestrator.refine(request);

    return {
      ok: true,
      data: payload,
    };
  }
}

function assertLegacyExperienceApiEnabled(): void {
  const flag = process.env.ENABLE_LEGACY_EXPERIENCE_API?.trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') {
    throw new ValidationError(
      'Legacy /api/experiences endpoints are disabled. Use chat runtime APIs instead.',
    );
  }
}
