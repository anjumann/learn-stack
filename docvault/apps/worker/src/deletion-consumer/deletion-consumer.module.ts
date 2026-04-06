import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeletionConsumerService } from './deletion-consumer.service';
import { Document, DocumentSchema } from '../shared/document.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }])],
  providers: [DeletionConsumerService],
})
export class DeletionConsumerModule {}
