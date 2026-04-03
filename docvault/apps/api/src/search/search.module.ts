import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { Document } from '../documents/document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
