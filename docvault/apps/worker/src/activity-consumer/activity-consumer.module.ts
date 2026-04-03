import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityConsumerService } from './activity-consumer.service';
import { ActivityLog } from '../shared/activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [ActivityConsumerService],
})
export class ActivityConsumerModule {}
