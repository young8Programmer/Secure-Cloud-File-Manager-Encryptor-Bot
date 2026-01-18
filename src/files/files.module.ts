import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { File } from '../database/entities/file.entity';
import { User } from '../database/entities/user.entity';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [TypeOrmModule.forFeature([File, User]), CryptoModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
