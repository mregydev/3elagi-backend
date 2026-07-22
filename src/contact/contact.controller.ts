import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  submit(
    @Request() req: { user: { id: string; email?: string; role?: string } },
    @Body() body: { message?: string; name?: string; email?: string },
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!body?.message?.trim()) {
      throw new BadRequestException('Message is required');
    }
    return this.contactService.submit({
      message: body.message,
      name: body.name,
      email: body.email || req.user.email,
      userId: req.user.id,
      role: req.user.role,
      files: files ?? [],
    });
  }
}
