import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MarketCurrency } from '../points/market-pricing.constants';

export interface PaymobCheckoutCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface CreatePaymobIntentionInput {
  /** Cash amount in major units (EGP or JOD). */
  amountMoney: number;
  currency: MarketCurrency;
  billingCountry: string;
  billingCity: string;
  points: number;
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
   * Card integration ID for Intention API.
   * Jordan can use PAYMOB_CARD_INTEGRATION_ID_JO when the merchant has a
   * separate JOD integration; otherwise the default EG integration is used.
   */
  private cardIntegrationId(currency: MarketCurrency): number {
    const raw =
      currency === 'JOD'
        ? this.readEnv(
            'PAYMOB_CARD_INTEGRATION_ID_JO',
            'PAYMOB_CARD_INTEGRATION_ID',
            'PAYMOB_INTEGRATION_ID',
            'PAYMOB_PAYMENT_METHODS',
          )
        : this.readEnv(
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
      integration_id_jo:
        this.readEnv('PAYMOB_CARD_INTEGRATION_ID_JO') || 'same as default',
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
    // EGP (piastres) and JOD (fils) both use 2 decimal minor units.
    const amountCents = Math.round(input.amountMoney * 100);
    if (amountCents < 100) {
      throw new BadRequestException(
        `Minimum payment is 1 ${input.currency}`,
      );
    }

    const integrationId = this.cardIntegrationId(input.currency);
    const defaultPhone =
      input.billingCountry === 'JO' ? '+962700000000' : '+201000000000';
    const phone = input.customer.phone?.trim() || defaultPhone;
    const body = {
      amount: amountCents,
      currency: input.currency,
      payment_methods: [integrationId],
      items: [
        {
          name: 'Message credits',
          amount: amountCents,
          description: `${input.points} credits (${input.amountMoney} ${input.currency})`,
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
        city: input.billingCity,
        country: input.billingCountry,
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
        `Paymob intention error (integration=${integrationId}, currency=${input.currency}): ${msg}`,
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
