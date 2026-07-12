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
      'PAYMENT_SECRENT_KEY', // common Cloud Run typo
      'PAYMOB_SECRET_KEY',
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

  /** Intention API payment_methods — UIG integrations use "card", not the dashboard integration id. */
  private paymentMethods(): Array<number | string> {
    const methodsEnv = this.readEnv('PAYMOB_PAYMENT_METHODS');
    if (methodsEnv) {
      return methodsEnv.split(',').map((part) => this.parsePaymentMethod(part));
    }
    // Default for Visa/Mastercard via Unified Checkout (integration 5776196 is UIG config).
    return ['card'];
  }

  private parsePaymentMethod(raw: string): number | string {
    const value = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!value) {
      throw new BadRequestException('Invalid payment method');
    }
    if (!/^\d+$/.test(value)) return value;
    const id = Number(value);
    if (!Number.isFinite(id) || id < 1) {
      throw new BadRequestException(`Invalid payment method: ${raw}`);
    }
    return id;
  }

  hmacSecret(): string {
    const apiKey = this.readEnv('PAYMENT_API_KEY', 'PAYMOB_HMAC_SECRET');
    // Some deployments mistakenly store the public key in PAYMENT_API_KEY.
    if (apiKey && !apiKey.includes('_pk_')) return apiKey;
    return this.readEnv('PAYMENT_SECRET_KEY', 'PAYMENT_SECRENT_KEY', 'PAYMOB_SECRET_KEY');
  }

  private formatIntentionError(raw: string): string {
    if (
      !raw.includes('Integration ID') &&
      !raw.includes('Integration ID/Name')
    ) {
      return raw;
    }
    return (
      'Paymob rejected the payment integration. In the Paymob dashboard (Test mode), open ' +
      'Developers → Payment Integrations, use a Card/online integration ID from that list ' +
      '(not the UIG checkout config alone), ensure it matches your test secret key, then set ' +
      'PAYMOB_PAYMENT_METHODS to that numeric ID or "card". If only UIG #5776196 appears, ' +
      'save the integration, set webhook/redirect URLs, and contact Paymob support to enable ' +
      'Intention API card processing for your merchant account.'
    );
  }

  buildCheckoutUrl(clientSecret: string): string {
    const publicKey = encodeURIComponent(this.publicKey());
    const secret = encodeURIComponent(clientSecret);
    return `${this.baseUrl()}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${secret}`;
  }

  async createCardIntention(
    input: CreatePaymobIntentionInput,
  ): Promise<PaymobIntentionResult> {
    const amountCents = Math.round(input.amountEgp * 100);
    if (amountCents < 100) {
      throw new BadRequestException('Minimum payment is 1 EGP');
    }

    const phone = input.customer.phone?.trim() || '+201000000000';
    const body = {
      amount: amountCents,
      currency: 'EGP',
      payment_methods: this.paymentMethods(),
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
      const raw =
        data.detail ||
        data.message ||
        `Paymob intention failed (${res.status})`;
      const msg = this.formatIntentionError(raw);
      this.logger.warn(
        `Paymob intention error (methods=${JSON.stringify(this.paymentMethods())}): ${raw}`,
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
