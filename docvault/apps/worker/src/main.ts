import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { collectDefaultMetrics } from 'prom-client';
import { AppModule } from './app/app.module';

collectDefaultMetrics();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env['WORKER_PORT'] ?? '3002';
  await app.listen(port);
  Logger.log(`DocVault Worker running on http://localhost:${port}`);
  Logger.log(`Prometheus metrics: http://localhost:${port}/metrics`);
}

bootstrap();
