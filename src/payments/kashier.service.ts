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

  /** V3 orders API base (FEP). */
  private ordersBase(): string {
    const override = this.readEnv('KASHIER_ORDERS_URL').replace(/\/$/, '');
    if (override) return override;
    return this.mode() === 'live'
      ? 'https://fep.kashier.io'
      : 'https://test-fep.kashier.io';
  }

  private formatAmount(amountEgp: number): string {
    return amountEgp.toFixed(2);
  }

  /** HMAC-SHA256 of `/<mid>/<orderRef>/<amount>/<currency>` signed with the secret. */
  private orderHash(orderRef: string, amount: string, currency: string): string {
    const path = `/${this.merchantId()}/${orderRef}/${amount}/${currency}`;
    return createHmac('sha256', this.paymentSecret()).update(path).digest('hex');
  }

  /**
   * Create a Kashier V3 order. Builds the signed payload (hash + valid Unix
   * timestamp) server-side and returns the hosted checkout URL to redirect to.
   */
  async createOrder(
    input: KashierCheckoutInput,
  ): Promise<{ checkoutUrl: string; kashierOrderId: string | null }> {
    const mid = this.merchantId();
    const currency = 'EGP';
    const amount = this.formatAmount(input.amountEgp);
    const hash = this.orderHash(input.orderId, amount, currency);
    const timestamp = Math.floor(Date.now() / 1000);

    const payload: Record<string, unknown> = {
      merchantId: mid,
      amount,
      currency,
      merchantOrderId: input.orderId,
      orderReference: input.orderId,
      hash,
      timestamp,
      mode: this.mode(),
      merchantRedirect: input.redirectUrl,
      serverWebhook: input.webhookUrl,
      allowedMethods: 'card',
      display: 'en',
      metadata: { orderReference: input.orderId },
    };
    if (input.customer?.email) payload.customerEmail = input.customer.email;
    if (input.customer?.name) payload.customerReference = input.customer.name;

    let res: Response;
    try {
      res = await fetch(`${this.ordersBase()}/v3/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: this.apiKey(),
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      this.logger.error('Kashier order request failed', err as Error);
      throw new BadRequestException('Could not reach the payment provider');
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      this.logger.warn(
        `Kashier order error ${res.status}: ${JSON.stringify(data)}`,
      );
      const detail =
        (data.message as string) ||
        (data.messages as string) ||
        JSON.stringify(data);
      throw new BadRequestException(`Kashier order failed (${res.status}): ${detail}`);
    }

    const body = (data.data as Record<string, unknown>) ?? data;
    const checkoutUrl =
      (body.checkoutUrl as string) ||
      (body.redirectUrl as string) ||
      (body.url as string) ||
      (data.checkoutUrl as string) ||
      '';
    const kashierOrderId =
      (body.orderId as string) ||
      (body.kashierOrderId as string) ||
      (body.id as string) ||
      null;

    if (!checkoutUrl) {
      this.logger.warn(`Kashier order returned no checkout URL: ${JSON.stringify(data)}`);
      throw new BadRequestException(
        'Kashier did not return a checkout URL. Response: ' + JSON.stringify(data),
      );
    }

    return { checkoutUrl, kashierOrderId };
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
      orders_base: this.ordersBase(),
      mode: this.mode(),
      merchant_id: this.readEnv('MERCHAT_ID', 'MERCHANT_ID', 'KASHIER_MERCHANT_ID') || 'MISSING',
      api_key: mask(this.apiKey()),
      payment_secret: mask(
        this.readEnv('PAYMENT_API_SECRET', 'KASHIER_SECRET', 'PAYMENT_SECRET_KEY'),
      ),
    };
  }
}
