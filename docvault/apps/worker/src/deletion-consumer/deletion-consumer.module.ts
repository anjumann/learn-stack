import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeletionConsumerService } from './deletion-consumer.service';
import { Document } from '../shared/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [DeletionConsumerService],
})
export class DeletionConsumerModule {}
