import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaymobCheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreatePaymobIntentionInput {
  amountEgp: number;
  specialReference: string;
  notificationUrl: string;
  redirectionUrl: string;
  customer: PaymobCheckoutCustomer;
}

export interface PaymobIntentionResult {
  clientSecret: string;
  checkoutUrl: string;
  intentionId: string;
  orderId: number | null;
}

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return (
      this.config.get<string>('PAYMOB_BASE_URL')?.replace(/\/$/, '') ||
      'https://accept.paymob.com'
    );
  }

  private readEnv(...names: string[]): string {
    for (const name of names) {
      const value = this.config.get<string>(name)?.trim();
      if (value) return value;
    }
    return '';
  }

  private secretKey(): string {
    const key = this.readEnv(
      'PAYMENT_SECRET_KEY',
      'PAYMOB_SECRET_KEY',
      'PAYMENT_SECRENT_KEY',
    );
    if (!key) {
      throw new BadRequestException(
        'Payment provider is not configured (missing PAYMENT_SECRET_KEY)',
      );
    }
    return key;
  }

  private publicKey(): string {
    const key = this.readEnv('PAYMENT_PUBLIC_KEY', 'PAYMOB_PUBLIC_KEY');
    if (!key) {
      throw new BadRequestException(
        'Payment provider is not configured (missing PAYMENT_PUBLIC_KEY)',
      );
    }
    return key;
  }

  /**
   * Card (VPC/online) integration ID for Intention API.
   * Prefer PAYMOB_CARD_INTEGRATION_ID. If PAYMOB_PAYMENT_METHODS is a comma list,
   * the first numeric ID is used. UIG IDs alone are rejected by Intention API —
   * use the sibling VPC/online integration instead.
   */
  private cardIntegrationId(): number {
    const raw = this.readEnv(
      'PAYMOB_CARD_INTEGRATION_ID',
      'PAYMOB_INTEGRATION_ID',
      'PAYMOB_PAYMENT_METHODS',
    );
    const id = Number(raw?.split(',')[0]?.trim());
    if (!raw || !Number.isFinite(id) || id < 1) {
      throw new BadRequestException(
        'Payment provider is not configured (missing PAYMOB_CARD_INTEGRATION_ID)',
      );
    }
    return id;
  }

  hmacSecret(): string {
    const hmac = this.readEnv(
      'PAYMOB_HMAC',
      'PAYMENT_HMAC',
      'PAYMOB_HMAC_SECRET',
      'PAYMENT_API_KEY',
    );
    if (hmac && !hmac.includes('_pk_') && !hmac.includes('_sk_')) {
      return hmac;
    }
    return this.secretKey();
  }

  buildCheckoutUrl(clientSecret: string): string {
    const publicKey = encodeURIComponent(this.publicKey());
    const secret = encodeURIComponent(clientSecret);
    return `${this.baseUrl()}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${secret}`;
  }

  debugConfig(): Record<string, unknown> {
    const mask = (v: string) =>
      v ? `${v.slice(0, 12)}…(len ${v.length})` : 'MISSING';
    return {
      provider: 'paymob',
      base_url: this.baseUrl(),
      integration_id: this.readEnv(
        'PAYMOB_CARD_INTEGRATION_ID',
        'PAYMOB_INTEGRATION_ID',
      ) || 'MISSING',
      public_key: mask(this.readEnv('PAYMENT_PUBLIC_KEY', 'PAYMOB_PUBLIC_KEY')),
      secret_key: mask(
        this.readEnv('PAYMENT_SECRET_KEY', 'PAYMOB_SECRET_KEY', 'PAYMENT_SECRENT_KEY'),
      ),
      hmac: mask(this.hmacSecret()),
    };
  }

  async createCardIntention(
    input: CreatePaymobIntentionInput,
  ): Promise<PaymobIntentionResult> {
    const amountCents = Math.round(input.amountEgp * 100);
    if (amountCents < 100) {
      throw new BadRequestException('Minimum payment is 1 EGP');
    }

    const integrationId = this.cardIntegrationId();
    const phone = input.customer.phone?.trim() || '+201000000000';
    const body = {
      amount: amountCents,
      currency: 'EGP',
      payment_methods: [integrationId,"wallet"],
      items: [
        {
          name: 'Message credits',
          amount: amountCents,
          description: `${input.amountEgp} EGP message credits`,
          quantity: 1,
        },
      ],
      billing_data: {
        apartment: 'NA',
        floor: 'NA',
        street: 'NA',
        building: 'NA',
        shipping_method: 'NA',
        postal_code: 'NA',
        city: 'Cairo',
        country: 'EG',
        state: 'NA',
        first_name: input.customer.firstName,
        last_name: input.customer.lastName,
        email: input.customer.email,
        phone_number: phone,
      },
      customer: {
        first_name: input.customer.firstName,
        last_name: input.customer.lastName,
        email: input.customer.email,
      },
      special_reference: input.specialReference,
      notification_url: input.notificationUrl,
      redirection_url: input.redirectionUrl,
    };

    const res = await fetch(`${this.baseUrl()}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.secretKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      client_secret?: string;
      id?: string;
      intention_order_id?: number;
      detail?: string;
      message?: string;
    };

    if (!res.ok || !data.client_secret) {
      const msg =
        data.detail ||
        data.message ||
        `Paymob intention failed (${res.status})`;
      this.logger.warn(
        `Paymob intention error (integration=${integrationId}): ${msg}`,
      );
      throw new BadRequestException(msg);
    }

    return {
      clientSecret: data.client_secret,
      checkoutUrl: this.buildCheckoutUrl(data.client_secret),
      intentionId: data.id ?? '',
      orderId: data.intention_order_id ?? null,
    };
  }
}
