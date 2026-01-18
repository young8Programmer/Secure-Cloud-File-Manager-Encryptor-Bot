import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoldersService } from './folders.service';
import { Folder } from '../database/entities/folder.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Folder, User])],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
