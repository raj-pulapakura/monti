import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Last-Event-ID'],
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(process.env.PORT ?? 3001, '::');
}

void bootstrap();

function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
