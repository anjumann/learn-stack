import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly svc: ActivityService) {}

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.findPaginated(Number(page), Number(limit));
  }
}
