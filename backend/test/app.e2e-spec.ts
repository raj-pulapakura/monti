import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './../src/app.controller';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let appController: AppController;

  beforeEach(async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    appController = moduleFixture.get<AppController>(AppController);
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    expect(appController.getHealth()).toEqual({
      ok: true,
      status: 'healthy',
      service: 'monti-backend',
    });
  });
});
