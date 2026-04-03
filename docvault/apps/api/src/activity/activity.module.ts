import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { ActivityLog } from './activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityService],
  controllers: [ActivityController],
  exports: [ActivityService],
})
export class ActivityModule {}
