import { Controller, Get, Param } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { ExperiencePlayRepository } from './services/experience-play.repository';

@Controller('api/play')
export class ExperiencePlayController {
  constructor(private readonly repository: ExperiencePlayRepository) {}

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const experience = await this.repository.findBySlug(slug);

    if (!experience) {
      throw new AppError('VALIDATION_ERROR', 'Experience not found.', 404);
    }

    return {
      ok: true,
      data: experience,
    };
  }
}
