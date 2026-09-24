import { otelSDK } from './otel-setup';

otelSDK.start();

import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    process.env.NODE_ENV === 'production'
      ? helmet()
      : helmet({ contentSecurityPolicy: false }),
  );

  await app.listen(process.env.PORT ?? 3004, '0.0.0.0');
}
void bootstrap();
