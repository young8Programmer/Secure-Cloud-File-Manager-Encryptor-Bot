import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilesService } from '../files/files.service';

@Injectable()
export class TasksService {
  constructor(private filesService: FilesService) {}

  /**
   * Cleanup expired files every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredFilesCleanup() {
    console.log('Running expired files cleanup...');
    const deletedCount = await this.filesService.cleanupExpiredFiles();
    if (deletedCount > 0) {
      console.log(`Deleted ${deletedCount} expired files`);
    }
  }
}
