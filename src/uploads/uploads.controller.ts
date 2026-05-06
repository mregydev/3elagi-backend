import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('file')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'image/jpeg', 'image/png', 'image/webp', 'image/gif',
          'application/pdf',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new HttpException(
            'Only JPEG, PNG, WebP, GIF images and PDF files are allowed',
            HttpStatus.UNPROCESSABLE_ENTITY,
          ), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }
    return this.uploadsService.uploadFile(file);
  }

  @Get('request-url')
  @UseGuards(JwtAuthGuard)
  async requestPresignedUrl() {
    return this.uploadsService.getPresignedUrl();
  }

  @Get('serve/local-uploads/:filename')
  serveLocalFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'local-uploads', safeName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  }

  @Get('serve/objects/*')
  async serveGCSFile(@Param('0') objectPath: string, @Res() res: Response) {
    return this.uploadsService.streamGCSFile(objectPath, res);
  }
}
