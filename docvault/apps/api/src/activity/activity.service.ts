import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityDto } from '@docvault/types';
import { ActivityLog, ActivityLogDocument } from './activity-log.entity';

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityModel: Model<ActivityLogDocument>,
  ) {}

  async findPaginated(
    page = 1,
    limit = 20,
  ): Promise<{ items: ActivityDto[]; total: number; page: number; limit: number }> {
    const [rows, total] = await Promise.all([
      this.activityModel
        .find()
        .sort({ occurredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.activityModel.countDocuments(),
    ]);

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
