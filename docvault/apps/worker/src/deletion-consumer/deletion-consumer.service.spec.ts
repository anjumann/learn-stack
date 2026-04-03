import { Test, TestingModule } from '@nestjs/testing';
import { DeletionConsumerService } from './deletion-consumer.service';

describe('DeletionConsumerService', () => {
  let service: DeletionConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DeletionConsumerService],
    }).compile();

    service = module.get<DeletionConsumerService>(DeletionConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
