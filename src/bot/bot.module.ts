import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { FoldersModule } from '../folders/folders.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [UsersModule, FilesModule, FoldersModule, QuotaModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
