import { NestFactory } from '@nestjs/core';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
