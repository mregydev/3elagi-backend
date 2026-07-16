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
import { UploadsService, isAllowedUploadMime } from './uploads.service';
import { UploadFileBase64Dto } from './dto/upload-file-base64.dto';
import { CompleteChunkUploadDto, InitChunkUploadDto } from './dto/chunk-upload.dto';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

/** Also accept legacy `/upload/*` paths used by some clients. */
@Controller(['uploads', 'upload'])
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('file')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (isAllowedUploadMime(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new HttpException(
            'File type not allowed. Supported: images, PDF, DOCX, audio, and video.',
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

  @Post('chunk/init')
  @UseGuards(JwtAuthGuard)
  initChunkUpload(@Body() dto: InitChunkUploadDto) {
    return this.uploadsService.initChunkUpload(dto);
  }

  @Post('chunk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('chunk', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadChunk(
    @Body('upload_id') uploadId: string,
    @Body('chunk_index') chunkIndexRaw: string,
    @UploadedFile() chunk: Express.Multer.File,
  ) {
    if (!uploadId?.trim()) {
      throw new HttpException('upload_id is required', HttpStatus.BAD_REQUEST);
    }
    if (!chunk) {
      throw new HttpException('No chunk provided', HttpStatus.BAD_REQUEST);
    }
    const chunkIndex = Number.parseInt(chunkIndexRaw, 10);
    return this.uploadsService.saveChunkUpload(uploadId.trim(), chunkIndex, chunk.buffer);
  }

  @Post('chunk/complete')
  @UseGuards(JwtAuthGuard)
  async completeChunkUpload(@Body() dto: CompleteChunkUploadDto) {
    return this.uploadsService.completeChunkUpload(dto.upload_id);
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
