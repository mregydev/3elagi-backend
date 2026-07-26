import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

/**
 * Single nodemailer transporter for all transactional mail
 * (verification, password reset, contact us).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly emailUser: string | null;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('EMAIL_USER')?.trim() || null;
    const pass = this.config.get<string>('EMAIL_PASSWORD')?.trim() || null;
    this.emailUser = user;

    if (user && pass) {
      // 587 = STARTTLS (default), 465 = SSL
      const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
      const useSsl = port === 465;
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: useSsl ? 465 : 587,
        secure: useSsl,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(
        `Nodemailer ready (smtp.gmail.com:${useSsl ? 465 : 587} as ${user})`,
      );
    } else {
      this.logger.warn(
        'EMAIL_USER / EMAIL_PASSWORD not set. Emails will be logged only.',
      );
    }
  }

  private fromAddress(): string {
    // Gmail requires From to match the authenticated account (or an alias).
    return (
      this.config.get<string>('MAIL_FROM')?.trim() ||
      this.emailUser ||
      'noreply@3elagi.com'
    );
  }

  /** Shared send path — used by verification, reset, and contact. */
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

    try {
      const info = await this.transporter.sendMail({
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
      this.logger.log(
        `Email sent via nodemailer to=${options.to} subject="${options.subject}" id=${info.messageId}`,
      );
    } catch (err) {
      this.logger.error(
        `Nodemailer send failed to=${options.to} subject="${options.subject}"`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
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
    const subject = input.fromEmail
      ? `3elagi contact: ${input.fromName || 'User'} <${input.fromEmail}>`
      : `3elagi contact: ${input.fromName || 'User'}`;
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
      'Open this link to choose a new password:',
      resetUrl,
      '',
      'This link expires in 1 hour.',
      'If you did not request a reset, you can ignore this email.',
    ].join('\n');
    const safeUrl = resetUrl.replace(/"/g, '&quot;');
    const html = [
      '<div style="font-family:sans-serif;line-height:1.5;color:#111">',
      '<p>We received a request to reset your 3elagi password.</p>',
      `<p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;background:#0B6E99;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Reset your password</a></p>`,
      `<p style="word-break:break-all;font-size:13px;color:#555">Or copy this link:<br/>${safeUrl}</p>`,
      '<p>This link expires in 1 hour.</p>',
      '<p>If you did not request a reset, you can ignore this email.</p>',
      '</div>',
    ].join('');
    await this.sendMail({ to: email, subject, text, html });
  }
}
