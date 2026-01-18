import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { FilesService } from './files.service';

@Controller('download')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Get(':token')
  async downloadByToken(@Param('token') token: string, @Res() res: Response) {
    try {
      const { buffer, originalName, mimeType } =
        await this.filesService.downloadFileByToken(token);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.send(buffer);
    } catch (error) {
      throw new NotFoundException('Invalid or expired download link');
    }
  }
}
