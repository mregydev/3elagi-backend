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
import { KashierService } from './kashier.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly kashier: KashierService,
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

  paymentConfigCheck(): Record<string, unknown> {
    return this.kashier.debugConfig();
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

    const orderId = `credits-${userId.slice(0, 8)}-${randomUUID()}`;
    const intention = await this.intentionRepo.save(
      this.intentionRepo.create({
        user_id: userId,
        amount_egp: amountEgp,
        special_reference: orderId,
        status: 'pending',
      }),
    );

    const apiBase = this.apiPublicBase();
    const { checkoutUrl } = await this.kashier.createOrder({
      orderId,
      amountEgp,
      redirectUrl: `${apiBase}/payments/kashier/return`,
      webhookUrl: `${apiBase}/payments/kashier/webhook`,
      customer: {
        email: user.email,
        name: displayName,
        phone: profile?.phone,
      },
    });

    return {
      intention_id: intention.id,
      special_reference: orderId,
      checkout_url: checkoutUrl,
    };
  }

  async handleKashierWebhook(body: Record<string, unknown>): Promise<void> {
    // Kashier posts { event, data: {...} }; some setups send the data flat.
    const data =
      (body.data as Record<string, unknown>) ??
      (body as Record<string, unknown>);

    if (!this.kashier.verifyWebhook(data)) {
      throw new BadRequestException('Invalid signature');
    }

    const reference =
      (typeof data.merchantOrderId === 'string' && data.merchantOrderId) ||
      (typeof data.orderId === 'string' && data.orderId) ||
      '';
    if (!reference) {
      this.logger.warn('Kashier webhook missing merchantOrderId');
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

    const txnId = String(data.transactionId ?? data.kashierOrderId ?? '');
    const success = String(data.status ?? '').toUpperCase() === 'SUCCESS';
    if (!success) {
      intention.status = 'failed';
      intention.paymob_transaction_id = txnId;
      await this.intentionRepo.save(intention);
      return;
    }

    const paidAmount = Number(data.amount);
    if (
      Number.isFinite(paidAmount) &&
      paidAmount > 0 &&
      Math.round(paidAmount) !== intention.amount_egp
    ) {
      this.logger.error(
        `Kashier amount mismatch for ${reference}: got ${paidAmount}, expected ${intention.amount_egp}`,
      );
      throw new BadRequestException('Amount mismatch');
    }

    await this.points.addPoints(intention.user_id, intention.amount_egp);
    intention.status = 'paid';
    intention.paymob_transaction_id = txnId;
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
