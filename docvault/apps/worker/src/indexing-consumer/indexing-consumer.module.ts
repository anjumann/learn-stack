import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexingConsumerService } from './indexing-consumer.service';
import { Document, DocumentSchema } from '../shared/document.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }])],
  providers: [IndexingConsumerService],
})
export class IndexingConsumerModule {}
