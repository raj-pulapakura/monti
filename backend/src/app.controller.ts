import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth() {
    return {
      ok: true,
      status: 'healthy',
      service: 'monti-backend',
    };
  }
}
