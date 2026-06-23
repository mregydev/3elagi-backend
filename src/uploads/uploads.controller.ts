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
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService, ALLOWED_UPLOAD_MIMES } from './uploads.service';
import { UploadFileBase64Dto } from './dto/upload-file-base64.dto';
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
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype as (typeof ALLOWED_UPLOAD_MIMES)[number])) {
          cb(null, true);
        } else {
          cb(new HttpException(
            'File type not allowed. Supported: images, PDF, audio, and video.',
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

  @Post('file64')
  @UseGuards(JwtAuthGuard)
  async uploadFileBase64(@Body() dto: UploadFileBase64Dto) {
    return this.uploadsService.uploadFileFromBase64(
      dto.file,
      dto.filename,
      dto.mimetype,
    );
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
