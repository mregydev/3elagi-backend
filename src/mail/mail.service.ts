import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Transporter from 'nodemailer/lib/mailer';

/**
 * Transactional mail (verification, password reset, contact) uses EMAIL_USER.
 * Marketing mail uses its own SMTP_USER / SMTP_PASS pair so the From address
 * matches marketing@3elagi.net (or whatever SMTP_USER is set to).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private marketingTransporter: Transporter | null = null;
  private readonly emailUser: string | null;
  private readonly marketingFromEmail: string | null;

  constructor(private readonly config: ConfigService) {
    const emailUser = this.config.get<string>('EMAIL_USER')?.trim() || null;
    const emailPass = this.config.get<string>('EMAIL_PASSWORD')?.trim() || null;
    this.emailUser = emailUser;

    const marketingUser = this.config.get<string>('SMTP_USER')?.trim() || null;
    const marketingPass = this.config.get<string>('SMTP_PASS')?.trim() || null;
    this.marketingFromEmail = marketingUser;

    const smtpPort = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const smtpHost =
      this.config.get<string>('SMTP_HOST')?.trim() || 'smtp.gmail.com';

    if (emailUser && emailPass) {
      this.transporter = this.createSmtpTransporter(
        smtpHost,
        smtpPort,
        emailUser,
        emailPass,
      );
      this.logger.log(
        `Transactional mail ready (${smtpHost}:${smtpPort} as ${emailUser})`,
      );
    } else {
      this.logger.warn(
        'EMAIL_USER / EMAIL_PASSWORD not set. Transactional emails will be logged only.',
      );
    }

    if (marketingUser && marketingPass) {
      this.marketingTransporter = this.createSmtpTransporter(
        smtpHost,
        smtpPort,
        marketingUser,
        marketingPass,
      );
      this.logger.log(
        `Marketing mail ready (${smtpHost}:${smtpPort} as ${marketingUser})`,
      );
    } else if (marketingUser) {
      this.logger.warn(
        `SMTP_USER=${marketingUser} but SMTP_PASS is missing. Marketing emails will fail.`,
      );
    } else {
      this.logger.warn(
        'SMTP_USER / SMTP_PASS not set. Marketing emails will fail until configured.',
      );
    }
  }

  private createSmtpTransporter(
    host: string,
    port: number,
    user: string,
    pass: string,
  ): Transporter {
    const useSsl = port === 465;
    return nodemailer.createTransport({
      host,
      port: useSsl ? 465 : port,
      secure: useSsl,
      auth: { user, pass },
    });
  }

  private fromAddress(displayName?: string, emailOverride?: string): string {
    const email =
      emailOverride?.trim() ||
      this.config.get<string>('MAIL_FROM')?.trim() ||
      this.emailUser ||
      'noreply@3elagi.com';
    if (displayName?.trim()) {
      return `"${displayName.replace(/"/g, '')}" <${email}>`;
    }
    return email;
  }

  /** Shared send path for transactional mail. */
  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
    fromName?: string;
    fromEmail?: string;
    attachments?: Array<{
      filename: string;
      content?: Buffer;
      path?: string;
      cid?: string;
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
        from: this.fromAddress(options.fromName, options.fromEmail),
        to: options.to,
        replyTo: options.replyTo,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text.replace(/\n/g, '<br/>'),
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          path: a.path,
          cid: a.cid,
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

  /** Marketing mail always sends from SMTP_USER (e.g. marketing@3elagi.net). */
  async sendDoctorMarketingInvite(input: {
    to: string;
    recipientName: string;
    subject: string;
    text: string;
    html: string;
    attachments: Array<{
      filename: string;
      path?: string;
      content?: Buffer;
      cid: string;
      contentType?: string;
    }>;
  }): Promise<void> {
    const fromEmail = this.marketingFromEmail;
    if (!fromEmail) {
      throw new Error(
        'SMTP_USER is not configured. Set SMTP_USER=marketing@3elagi.net and SMTP_PASS in the API environment.',
      );
    }

    const from = this.fromAddress('3elagi Marketing Team', fromEmail);

    if (!this.marketingTransporter) {
      this.logger.log(
        `[dev-mail] marketing from=${from} to=${input.to} subject=${input.subject}\n${input.text}` +
          (input.attachments?.length
            ? `\nattachments=${input.attachments.map((a) => a.filename).join(', ')}`
            : ''),
      );
      return;
    }

    try {
      const info = await this.marketingTransporter.sendMail({
        from,
        sender: fromEmail,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          path: a.path,
          cid: a.cid,
          contentType: a.contentType,
        })),
      });
      this.logger.log(
        `Marketing email sent from=${fromEmail} to=${input.to} subject="${input.subject}" id=${info.messageId}`,
      );
    } catch (err) {
      this.logger.error(
        `Marketing send failed from=${fromEmail} to=${input.to} subject="${input.subject}"`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
