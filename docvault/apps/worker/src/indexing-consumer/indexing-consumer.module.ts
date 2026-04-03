import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexingConsumerService } from './indexing-consumer.service';
import { Document } from '../shared/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [IndexingConsumerService],
})
export class IndexingConsumerModule {}
