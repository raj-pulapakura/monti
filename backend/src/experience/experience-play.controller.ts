import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { ExperiencePlayRepository } from './services/experience-play.repository';

@Controller('api/play')
export class ExperiencePlayController {
  constructor(private readonly repository: ExperiencePlayRepository) {}

  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
    @Query('v') v?: string,
  ) {
    let versionNumber: number | undefined;
    if (v !== undefined) {
      const parsed = parseInt(v, 10);
      if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== v) {
        throw new BadRequestException('v must be a positive integer.');
      }
      versionNumber = parsed;
    }

    const experience = await this.repository.findBySlug(slug, versionNumber);

    if (!experience) {
      throw new AppError('VALIDATION_ERROR', 'Experience not found.', 404);
    }

    return {
      ok: true,
      data: experience,
    };
  }
}
