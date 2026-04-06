import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { ActivityLog, ActivityLogSchema } from './activity-log.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: ActivityLog.name, schema: ActivityLogSchema }])],
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
})
export class ActivityModule {}
