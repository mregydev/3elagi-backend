import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST')?.trim();
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER')?.trim();
    const pass = this.config.get<string>('SMTP_PASS')?.trim();
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number.isFinite(port) ? port : 587,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Emails will be logged only.',
      );
    }
  }

  private fromAddress(): string {
    return (
      this.config.get<string>('MAIL_FROM')?.trim() ||
      this.config.get<string>('SMTP_USER')?.trim() ||
      'noreply@3elagi.com'
    );
  }

  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.log(
        `[dev-mail] to=${options.to} subject=${options.subject}\n${options.text}` +
          (options.attachments?.length
            ? `\nattachments=${options.attachments.map((a) => a.filename).join(', ')}`
            : ''),
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.fromAddress(),
      to: options.to,
      replyTo: options.replyTo,
      subject: options.subject,
      text: options.text,
      html: options.html ?? options.text.replace(/\n/g, '<br/>'),
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }

  async sendContactMessage(input: {
    to: string;
    fromName: string;
    fromEmail: string;
    userId?: string;
    role?: string;
    message: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType?: string;
    }>;
  }): Promise<void> {
    const subject = `3elagi contact: ${input.fromName || input.fromEmail}`;
    const text = [
      'New contact message from the 3elagi app.',
      '',
      `Name: ${input.fromName || '—'}`,
      `Email: ${input.fromEmail || '—'}`,
      `User ID: ${input.userId || '—'}`,
      `Role: ${input.role || '—'}`,
      '',
      'Message:',
      input.message,
      '',
      input.attachments?.length
        ? `Attachments: ${input.attachments.map((a) => a.filename).join(', ')}`
        : 'Attachments: none',
    ].join('\n');
    await this.sendMail({
      to: input.to,
      replyTo: input.fromEmail || undefined,
      subject,
      text,
      attachments: input.attachments,
    });
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    const subject = 'Your 3elagi verification code';
    const text = [
      'Welcome to 3elagi.',
      '',
      `Your verification code is: ${code}`,
      '',
      'This code expires in 15 minutes.',
      'If you did not create an account, you can ignore this email.',
    ].join('\n');
    await this.sendMail({ to: email, subject, text });
  }

  async sendPasswordResetLink(email: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your 3elagi password';
    const text = [
      'We received a request to reset your 3elagi password.',
      '',
      `Open this link to choose a new password:`,
      resetUrl,
      '',
      'This link expires in 1 hour.',
      'If you did not request a reset, you can ignore this email.',
    ].join('\n');
    const html = [
      '<p>We received a request to reset your 3elagi password.</p>',
      `<p><a href="${resetUrl}">Reset your password</a></p>`,
      '<p>This link expires in 1 hour.</p>',
      '<p>If you did not request a reset, you can ignore this email.</p>',
    ].join('');
    await this.sendMail({ to: email, subject, text, html });
  }
}
