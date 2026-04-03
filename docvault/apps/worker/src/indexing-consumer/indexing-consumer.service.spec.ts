import { Test, TestingModule } from '@nestjs/testing';
import { IndexingConsumerService } from './indexing-consumer.service';

describe('IndexingConsumerService', () => {
  let service: IndexingConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IndexingConsumerService],
    }).compile();

    service = module.get<IndexingConsumerService>(IndexingConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
