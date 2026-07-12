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

  private secretKey(): string {
    const key =
      this.config.get<string>('PAYMENT_SECRET_KEY')?.trim() ||
      this.config.get<string>('PAYMOB_SECRET_KEY')?.trim();
    if (!key) {
      throw new BadRequestException('Payment provider is not configured');
    }
    return key;
  }

  private publicKey(): string {
    const key =
      this.config.get<string>('PAYMENT_PUBLIC_KEY')?.trim() ||
      this.config.get<string>('PAYMOB_PUBLIC_KEY')?.trim();
    if (!key) {
      throw new BadRequestException('Payment provider is not configured');
    }
    return key;
  }

  private cardIntegrationId(): number {
    const raw =
      this.config.get<string>('PAYMOB_CARD_INTEGRATION_ID')?.trim() ||
      '5776196';
    const id = Number(raw);
    if (!Number.isFinite(id) || id < 1) {
      throw new BadRequestException('Invalid card integration id');
    }
    return id;
  }

  hmacSecret(): string {
    return (
      this.config.get<string>('PAYMENT_API_KEY')?.trim() ||
      this.config.get<string>('PAYMOB_HMAC_SECRET')?.trim() ||
      ''
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
      payment_methods: [this.cardIntegrationId()],
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
      this.logger.warn(`Paymob intention error: ${msg}`);
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
