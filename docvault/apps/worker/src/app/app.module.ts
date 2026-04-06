import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { IndexingConsumerModule } from '../indexing-consumer/indexing-consumer.module';
import { DeletionConsumerModule } from '../deletion-consumer/deletion-consumer.module';
import { ActivityConsumerModule } from '../activity-consumer/activity-consumer.module';
import { EmailConsumerModule } from '../email-consumer/email-consumer.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URL'),
      }),
    }),
    IndexingConsumerModule,
    DeletionConsumerModule,
    ActivityConsumerModule,
    EmailConsumerModule,
    MetricsModule,
  ],
})
export class AppModule {}
