import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { BotModule } from './bot/bot.module';
import { FilesModule } from './files/files.module';
import { FoldersModule } from './folders/folders.module';
import { CryptoModule } from './crypto/crypto.module';
import { UsersModule } from './users/users.module';
import { QuotaModule } from './quota/quota.module';
import { TasksService } from './tasks/tasks.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CryptoModule,
    UsersModule,
    FilesModule,
    FoldersModule,
    QuotaModule,
    BotModule,
  ],
  providers: [TasksService],
})
export class AppModule {}
