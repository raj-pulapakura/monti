import { Body, Controller, Post } from '@nestjs/common';
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
    const request = parseGenerateExperienceRequest(body);
    const payload = await this.orchestrator.generate(request);

    return {
      ok: true,
      data: payload,
    };
  }

  @Post('refine')
  async refine(@Body() body: unknown) {
    const request = parseRefineExperienceRequest(body);
    const payload = await this.orchestrator.refine(request);

    return {
      ok: true,
      data: payload,
    };
  }
}
