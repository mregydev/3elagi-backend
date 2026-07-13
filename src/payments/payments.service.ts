import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { PaymentIntention } from '../entities/payment-intention.entity';
import { PatientProfile } from '../entities/patient-profile.entity';
import { User } from '../entities/user.entity';
import { PointsService } from '../points/points.service';
import { validatePaymobTransactionHmac } from './paymob-hmac.util';
import { PaymobService } from './paymob.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymob: PaymobService,
    private readonly points: PointsService,
    private readonly config: ConfigService,
    @InjectRepository(PaymentIntention)
    private readonly intentionRepo: Repository<PaymentIntention>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
  ) {}

  private apiPublicBase(): string {
    return (
      this.config.get<string>('API_PUBLIC_BASE_URL')?.replace(/\/$/, '') ||
      'https://service-3elagi-q45gskkjsa-ew.a.run.app/3eyadahub-api'
    );
  }

  private webAppReturnBase(): string {
    return (
      this.config.get<string>('PAYMENT_RETURN_WEB_URL')?.replace(/\/$/, '') ||
      'https://3elagi-mobile.vercel.app'
    );
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: 'Customer', lastName: 'User' };
    if (parts.length === 1) return { firstName: parts[0], lastName: 'User' };
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  paymentConfigCheck(): Record<string, unknown> {
    return this.paymob.debugConfig();
  }

  async createCardCheckout(userId: string, amountEgp: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!Number.isFinite(amountEgp) || amountEgp < 1) {
      throw new BadRequestException('Minimum payment is 1 EGP');
    }

    const profile = await this.patientProfileRepo.findOne({
      where: { user_id: userId },
    });
    const displayName = profile?.name?.trim() || user.email.split('@')[0];
    const { firstName, lastName } = this.splitName(displayName);

    const specialReference = `credits-${userId.slice(0, 8)}-${randomUUID()}`;
    const intention = await this.intentionRepo.save(
      this.intentionRepo.create({
        user_id: userId,
        amount_egp: amountEgp,
        special_reference: specialReference,
        status: 'pending',
      }),
    );

    const apiBase = this.apiPublicBase();
    const paymob = await this.paymob.createCardIntention({
      amountEgp,
      specialReference,
      notificationUrl: `${apiBase}/payments/paymob/webhook`,
      redirectionUrl: `${apiBase}/payments/paymob/return`,
      customer: {
        email: user.email,
        firstName,
        lastName,
        phone: profile?.phone,
      },
    });

    return {
      intention_id: intention.id,
      special_reference: specialReference,
      checkout_url: paymob.checkoutUrl,
      client_secret: paymob.clientSecret,
    };
  }

  private resolveMerchantReference(
    body: Record<string, unknown>,
  ): string | null {
    const obj = body.obj as Record<string, unknown> | undefined;
    const order = obj?.order as Record<string, unknown> | undefined;
    const paymentKeyClaims = obj?.payment_key_claims as
      | Record<string, unknown>
      | undefined;
    const extras = paymentKeyClaims?.extra as Record<string, unknown> | undefined;

    const candidates = [
      obj?.merchant_order_id,
      order?.merchant_order_id,
      body.merchant_order_id,
      paymentKeyClaims?.special_reference,
      extras?.special_reference,
      body.special_reference,
    ];

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  async handlePaymobWebhook(
    body: Record<string, unknown>,
    hmac: string | undefined,
  ): Promise<void> {
    const hmacSecret = this.paymob.hmacSecret();
    const obj = body.obj as Record<string, unknown> | undefined;
    if (!obj || !hmacSecret) {
      throw new BadRequestException('Invalid webhook payload');
    }
    if (!validatePaymobTransactionHmac(obj, hmac, hmacSecret)) {
      throw new BadRequestException('Invalid HMAC');
    }

    const reference = this.resolveMerchantReference(body);
    if (!reference) {
      this.logger.warn('Paymob webhook missing merchant reference');
      return;
    }

    const intention = await this.intentionRepo.findOne({
      where: { special_reference: reference },
    });
    if (!intention) {
      this.logger.warn(`No payment intention for reference ${reference}`);
      return;
    }

    if (intention.status === 'paid') return;

    const success = obj.success === true || obj.success === 'true';
    if (!success) {
      intention.status = 'failed';
      intention.paymob_transaction_id = String(obj.id ?? '');
      await this.intentionRepo.save(intention);
      return;
    }

    const amountCents = Number(obj.amount_cents);
    const expectedCents = intention.amount_egp * 100;
    if (
      Number.isFinite(amountCents) &&
      amountCents > 0 &&
      amountCents !== expectedCents
    ) {
      this.logger.error(
        `Paymob amount mismatch for ${reference}: got ${amountCents}, expected ${expectedCents}`,
      );
      throw new BadRequestException('Amount mismatch');
    }

    await this.points.addPoints(intention.user_id, intention.amount_egp);
    intention.status = 'paid';
    intention.paymob_transaction_id = String(obj.id ?? '');
    await this.intentionRepo.save(intention);
  }

  buildReturnHtml(success: boolean): string {
    const status = success ? 'success' : 'failed';
    const deepLink = `threelagi://points?payment=${status}`;
    const webUrl = `${this.webAppReturnBase()}/points?payment=${status}`;
    const title = success ? 'Payment successful' : 'Payment failed';
    const message = success
      ? 'Credits will appear shortly. Returning to the app…'
      : 'Payment was not completed. Returning to the app…';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; background:#f8fafc; color:#0f172a; }
    .card { max-width: 420px; padding: 28px; border-radius: 16px; background: white; box-shadow: 0 10px 30px rgba(15,23,42,.08); text-align:center; }
    a { color: #2563eb; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <p><a href="${deepLink}">Open app</a> · <a href="${webUrl}">Continue on web</a></p>
  </div>
  <script>
    (function () {
      var deep = ${JSON.stringify(deepLink)};
      var web = ${JSON.stringify(webUrl)};
      try { window.location.href = deep; } catch (e) {}
      setTimeout(function () { window.location.href = web; }, 1200);
    })();
  </script>
</body>
</html>`;
  }
}
