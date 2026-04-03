import { Controller, Post, Body } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchRequestDto } from '@docvault/types';

@Controller('search')
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Post()
  search(@Body() dto: SearchRequestDto) {
    return this.svc.search(dto);
  }
}
