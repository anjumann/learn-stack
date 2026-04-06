import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityConsumerService } from './activity-consumer.service';
import { ActivityLog, ActivityLogSchema } from '../shared/activity-log.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: ActivityLog.name, schema: ActivityLogSchema }])],
  providers: [ActivityConsumerService],
})
export class ActivityConsumerModule {}
