import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexingConsumerModule } from '../indexing-consumer/indexing-consumer.module';
import { DeletionConsumerModule } from '../deletion-consumer/deletion-consumer.module';
import { ActivityConsumerModule } from '../activity-consumer/activity-consumer.module';
import { EmailConsumerModule } from '../email-consumer/email-consumer.module';
import { MetricsModule } from '../metrics/metrics.module';
import { Document } from '../shared/document.entity';
import { ActivityLog } from '../shared/activity-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [Document, ActivityLog],
        synchronize: false, // API handles schema
        logging: false,
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
