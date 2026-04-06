import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsModule } from '../documents/documents.module';
import { SearchModule } from '../search/search.module';
import { ActivityModule } from '../activity/activity.module';
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
    DocumentsModule,
    SearchModule,
    ActivityModule,
    MetricsModule,
  ],
})
export class AppModule {}
