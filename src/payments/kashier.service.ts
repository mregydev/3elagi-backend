import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

export interface KashierCheckoutInput {
  orderId: string;
  amountEgp: number;
  redirectUrl: string;
  webhookUrl: string;
  customer?: { email?: string; name?: string; phone?: string };
}

/**
 * Kashier Hosted Payment Page. We build a hash-signed checkout URL the client
 * redirects to — no server-to-server call, so nothing can 400 before the user
 * even reaches the payment page.
 * Hash (per Kashier docs): HMAC-SHA256 of `/?payment=<mid>.<orderId>.<amount>.<currency>`
 * signed with the payment secret.
 */
@Injectable()
export class KashierService {
  private readonly logger = new Logger(KashierService.name);

  constructor(private readonly config: ConfigService) {}

  private readEnv(...names: string[]): string {
    for (const name of names) {
      const value = this.config.get<string>(name)?.trim();
      if (value) return value;
    }
    return '';
  }

  private merchantId(): string {
    const mid = this.readEnv('MERCHAT_ID', 'MERCHANT_ID', 'KASHIER_MERCHANT_ID');
    if (!mid) {
      throw new BadRequestException('Payment provider is not configured (missing MERCHAT_ID)');
    }
    return mid;
  }

  /** Secret used to sign the Hosted Payment Page hash. */
  private paymentSecret(): string {
    const secret = this.readEnv(
      'PAYMENT_API_SECRET',
      'KASHIER_SECRET',
      'PAYMENT_SECRET_KEY',
    );
    if (!secret) {
      throw new BadRequestException(
        'Payment provider is not configured (missing PAYMENT_API_SECRET)',
      );
    }
    return secret;
  }

  /** API key used to verify webhook signatures. */
  private apiKey(): string {
    return this.readEnv('PAYMENT_API_KEY', 'KASHIER_API_KEY');
  }

  private mode(): 'test' | 'live' {
    const mode = this.readEnv('KASHIER_MODE', 'PAYMENT_MODE').toLowerCase();
    return mode === 'live' ? 'live' : 'test';
  }

  private checkoutBase(): string {
    return (
      this.readEnv('KASHIER_CHECKOUT_URL').replace(/\/$/, '') ||
      'https://checkout.kashier.io'
    );
  }

  private formatAmount(amountEgp: number): string {
    return amountEgp.toFixed(2);
  }

  buildCheckoutUrl(input: KashierCheckoutInput): string {
    const mid = this.merchantId();
    const currency = 'EGP';
    const amount = this.formatAmount(input.amountEgp);
    const path = `/?payment=${mid}.${input.orderId}.${amount}.${currency}`;
    const hash = createHmac('sha256', this.paymentSecret())
      .update(path)
      .digest('hex');

    const params = new URLSearchParams({
      merchantId: mid,
      orderId: input.orderId,
      amount,
      currency,
      hash,
      mode: this.mode(),
      merchantRedirect: input.redirectUrl,
      serverWebhook: input.webhookUrl,
      allowedMethods: 'card',
      display: 'en',
    });
    if (input.customer?.email) params.set('customerEmail', input.customer.email);
    if (input.customer?.name) params.set('customerReference', input.customer.name);

    return `${this.checkoutBase()}/?${params.toString()}`;
  }

  /**
   * Verify a Kashier webhook. Kashier signs `data` by concatenating the fields
   * listed in `data.signatureKeys` as `key=value&…` and HMAC-SHA256'ing with the
   * API key; the result is `data.signature`.
   */
  verifyWebhook(data: Record<string, unknown>): boolean {
    const signature = String(data.signature ?? '');
    const keys = Array.isArray(data.signatureKeys)
      ? (data.signatureKeys as string[])
      : [];
    if (!signature || !keys.length) return false;

    const queryString = keys
      .map((key) => `${key}=${data[key] ?? ''}`)
      .join('&');

    for (const secret of [this.apiKey(), this.paymentSecret()]) {
      if (!secret) continue;
      const computed = createHmac('sha256', secret)
        .update(queryString)
        .digest('hex');
      if (this.safeEqual(computed, signature)) return true;
    }
    this.logger.warn('Kashier webhook signature did not match');
    return false;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  debugConfig(): Record<string, unknown> {
    const mask = (v: string) =>
      v ? `${v.slice(0, 10)}…(len ${v.length})` : 'MISSING';
    return {
      provider: 'kashier',
      checkout_base: this.checkoutBase(),
      mode: this.mode(),
      merchant_id: this.readEnv('MERCHAT_ID', 'MERCHANT_ID', 'KASHIER_MERCHANT_ID') || 'MISSING',
      api_key: mask(this.apiKey()),
      payment_secret: mask(
        this.readEnv('PAYMENT_API_SECRET', 'KASHIER_SECRET', 'PAYMENT_SECRET_KEY'),
      ),
    };
  }
}
