import { Test, TestingModule } from '@nestjs/testing';
import { ActivityConsumerService } from './activity-consumer.service';

describe('ActivityConsumerService', () => {
  let service: ActivityConsumerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivityConsumerService],
    }).compile();

    service = module.get<ActivityConsumerService>(ActivityConsumerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
