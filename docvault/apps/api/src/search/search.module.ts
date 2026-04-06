import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { Document, DocumentSchema } from '../documents/document.entity';

@Module({
  imports: [MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }])],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
