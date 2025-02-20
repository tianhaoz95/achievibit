import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { ApiModule } from '@kb-api';
import { ConfigModule } from '@kb-config';
import { EventsGateway, EventsModule } from '@kb-events';
import { TasksModule } from '@kb-tasks';

import { AppController } from './app.controller';

@Module({
  imports: [
    ApiModule,
    ScheduleModule.forRoot(),
    EventsModule,
    ConfigModule,
    TasksModule
  ],
  controllers: [AppController],
  providers: [EventsGateway]
})
export class AppModule {}
