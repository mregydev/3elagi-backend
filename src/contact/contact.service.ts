import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContactSubmission,
  type ContactSubmissionAttachment,
} from '../entities/contact-submission.entity';
import { UploadsService } from '../uploads/uploads.service';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactSubmission)
    private readonly submissionRepo: Repository<ContactSubmission>,
    private readonly uploads: UploadsService,
  ) {}

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

    const fromEmail = (input.email || '').trim().toLowerCase() || null;
    const fromName = (input.name || '').trim() || fromEmail || '3elagi user';

    const attachments: ContactSubmissionAttachment[] = [];
    for (const file of files.filter((f) => f?.buffer?.length)) {
      try {
        const uploaded = await this.uploads.uploadFile({
          ...file,
          originalname: file.originalname || 'attachment',
          mimetype: file.mimetype || 'application/octet-stream',
        });
        attachments.push({
          file_name: file.originalname || 'attachment',
          mime_type: file.mimetype || 'application/octet-stream',
          url: uploaded.url,
          object_path: uploaded.objectPath ?? uploaded.path ?? null,
        });
      } catch {
        // Skip attachments that fail storage — message still lands in the inbox.
      }
    }

    const saved = await this.submissionRepo.save(
      this.submissionRepo.create({
        user_id: input.userId ?? null,
        sender_name: fromName,
        sender_email: fromEmail,
        sender_role: input.role?.trim() || null,
        message,
        attachments,
      }),
    );

    return { ok: true, id: saved.id };
  }

  async listForAdmin() {
    const rows = await this.submissionRepo.find({
      order: { created_at: 'DESC' },
      take: 200,
    });
    return rows.map((row) => this.mapSubmission(row, { includeMessage: false }));
  }

  async findOneForAdmin(id: string) {
    const row = await this.submissionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Contact message not found');
    if (!row.read_at) {
      row.read_at = new Date();
      await this.submissionRepo.save(row);
    }
    return this.mapSubmission(row, { includeMessage: true });
  }

  async markRead(id: string, read: boolean) {
    const row = await this.submissionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Contact message not found');
    row.read_at = read ? row.read_at ?? new Date() : null;
    await this.submissionRepo.save(row);
    return this.mapSubmission(row, { includeMessage: true });
  }

  private mapSubmission(
    row: ContactSubmission,
    opts: { includeMessage: boolean },
  ) {
    return {
      id: row.id,
      user_id: row.user_id,
      sender_name: row.sender_name,
      sender_email: row.sender_email,
      sender_role: row.sender_role,
      message: opts.includeMessage ? row.message : undefined,
      message_preview: row.message.slice(0, 160),
      attachments: row.attachments ?? [],
      read_at: row.read_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    };
  }
}
