import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityDto } from '@docvault/types';
import { ActivityLog } from './activity-log.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly repo: Repository<ActivityLog>,
  ) {}

  async findPaginated(
    page = 1,
    limit = 20,
  ): Promise<{ items: ActivityDto[]; total: number; page: number; limit: number }> {
    const [rows, total] = await this.repo.findAndCount({
      order: { occurredAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        documentId: r.documentId,
        filename: r.filename,
        occurredAt: r.occurredAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }
}
