import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  /**
   * Prometheus scrapes this endpoint every 10s.
   * It returns the default registry which includes:
   *   - Node.js process metrics (CPU, memory, event loop) — auto-collected
   *   - Custom DocVault counters/histograms registered in services
   */
  @Get()
  async metrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
