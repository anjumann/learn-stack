import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from '../documents/documents.module';
import { SearchModule } from '../search/search.module';
import { ActivityModule } from '../activity/activity.module';
import { MetricsModule } from '../metrics/metrics.module';
import { Document } from '../documents/document.entity';
import { ActivityLog } from '../activity/activity-log.entity';

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
        synchronize: true, // auto-creates tables — disable in production
        logging: false,
      }),
    }),
    DocumentsModule,
    SearchModule,
    ActivityModule,
    MetricsModule,
  ],
})
export class AppModule {}
