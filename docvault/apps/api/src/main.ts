import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { collectDefaultMetrics } from 'prom-client';
import { AppModule } from './app/app.module';

// Collect default Node.js metrics (CPU, memory, event loop lag, GC)
collectDefaultMetrics();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validate all incoming DTOs via class-validator decorators
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Enable CORS for Next.js frontend (dev: localhost:3000)
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000' });

  const port = process.env['API_PORT'] ?? '3001';
  await app.listen(port);
  Logger.log(`DocVault API running on http://localhost:${port}`);
  Logger.log(`Prometheus metrics: http://localhost:${port}/metrics`);
}

bootstrap();
