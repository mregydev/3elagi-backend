import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ContactService {
  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private contactTo(): string {
    return (
      this.config.get<string>('CONTACT_TO_EMAIL')?.trim() ||
      'alaahamed@3elagi.net'
    );
  }

  async submit(input: {
    message: string;
    name?: string;
    email?: string;
    userId?: string;
    role?: string;
    files?: Express.Multer.File[];
  }) {
    const message = (input.message || '').trim();
    if (message.length < 5) {
      throw new BadRequestException('Message must be at least 5 characters');
    }
    if (message.length > 5000) {
      throw new BadRequestException('Message is too long');
    }

    const files = input.files ?? [];
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`You can attach up to ${MAX_FILES} files`);
    }
    for (const file of files) {
      if (!file?.buffer?.length) continue;
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException(
          `Each attachment must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB`,
        );
      }
    }

    const fromEmail = (input.email || '').trim().toLowerCase();
    const fromName = (input.name || '').trim() || fromEmail || '3elagi user';

    await this.mail.sendContactMessage({
      to: this.contactTo(),
      fromName,
      fromEmail,
      userId: input.userId,
      role: input.role,
      message,
      attachments: files
        .filter((f) => f?.buffer?.length)
        .map((f) => ({
          filename: f.originalname || 'attachment',
          content: f.buffer,
          contentType: f.mimetype,
        })),
    });

    return { ok: true };
  }
}
