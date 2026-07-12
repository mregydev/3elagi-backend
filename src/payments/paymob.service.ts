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

  private checkoutMode(): 'auto' | 'intention' | 'quicklink' {
    const mode = this.readEnv('PAYMOB_CHECKOUT_MODE').toLowerCase();
    if (mode === 'intention' || mode === 'quicklink') return mode;
    return 'auto';
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

  /** Paymob Settings → API Keys (NOT the public/secret keys). */
  private legacyApiKey(): string {
    for (const name of [
      'PAYMOB_LEGACY_API_KEY',
      'PAYMOB_API_KEY',
      'PAYMENT_API_KEY',
    ]) {
      const value = this.readEnv(name);
      if (value && !value.includes('_pk_') && !value.includes('_sk_')) {
        return value;
      }
    }
    return '';
  }

  /** The merchant's card payment-integration id (defaults to the provided 5776196). */
  private cardIntegrationId(): number {
    const raw = this.readEnv(
      'PAYMOB_CARD_INTEGRATION_ID',
      'PAYMOB_INTEGRATION_ID',
      'PAYMENT_INTEGRATION_ID',
    );
    const id = Number(raw) || 5776196;
    if (!Number.isFinite(id) || id < 1) {
      throw new BadRequestException(
        'Payment provider is not configured (invalid PAYMOB_CARD_INTEGRATION_ID)',
      );
    }
    return id;
  }

  private isLiveMode(): boolean {
    const explicit = this.readEnv('PAYMOB_IS_LIVE').toLowerCase();
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    return this.secretKey().includes('_live_');
  }

  /**
   * Intention API payment_methods. Paymob expects the numeric payment-integration
   * id(s) here — the string 'card' is rejected by most accounts — so we default to
   * the merchant's card integration id (5776196) instead of 'card'.
   */
  private paymentMethods(): Array<number | string> {
    const methodsEnv = this.readEnv('PAYMOB_PAYMENT_METHODS');
    if (methodsEnv) {
      return methodsEnv.split(',').map((part) => this.parsePaymentMethod(part));
    }
    return [this.cardIntegrationId()];
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

  /**
   * The webhook HMAC secret — a DISTINCT value from Paymob Dashboard → Settings →
   * Account Info (HMAC), not the API/public/secret keys. Set PAYMOB_HMAC_SECRET or
   * PAYMENT_HMAC_SECRET; without it the webhook cannot verify callbacks and credits
   * won't be granted.
   */
  hmacSecret(): string {
    return this.readEnv('PAYMOB_HMAC_SECRET', 'PAYMENT_HMAC_SECRET');
  }

  private isIntegrationError(raw: string): boolean {
    return (
      raw.includes('Integration ID') || raw.includes('Integration ID/Name')
    );
  }

  private formatCheckoutError(raw: string): string {
    if (!this.isIntegrationError(raw)) return raw;
    if (!this.legacyApiKey()) {
      return (
        'Paymob Intention API is not enabled for this merchant account. Add ' +
        'PAYMOB_LEGACY_API_KEY from Paymob Dashboard → Settings → API Keys ' +
        '(this is NOT the public key currently stored in PAYMENT_API_KEY), ' +
        'keep PAYMOB_CARD_INTEGRATION_ID=5776196, redeploy the API, and checkout ' +
        'will use Quick Link as a fallback. Or contact support@paymob.com to enable ' +
        'Intention API card processing.'
      );
    }
    return `Paymob checkout failed: ${raw}`;
  }

  buildCheckoutUrl(clientSecret: string): string {
    const publicKey = encodeURIComponent(this.publicKey());
    const secret = encodeURIComponent(clientSecret);
    return `${this.baseUrl()}/unifiedcheckout/?publicKey=${publicKey}&clientSecret=${secret}`;
  }

  async createCardIntention(
    input: CreatePaymobIntentionInput,
  ): Promise<PaymobIntentionResult> {
    const mode = this.checkoutMode();
    if (mode === 'quicklink') {
      return this.createQuickLinkCheckout(input);
    }

    try {
      return await this.createIntentionCheckout(input);
    } catch (error) {
      const shouldFallback =
        mode === 'auto' &&
        error instanceof BadRequestException &&
        this.legacyApiKey();
      if (!shouldFallback) throw error;
      this.logger.warn('Intention API failed; falling back to Quick Link checkout');
      return this.createQuickLinkCheckout(input);
    }
  }

  private async createIntentionCheckout(
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
      this.logger.warn(
        `Paymob intention error (methods=${JSON.stringify(this.paymentMethods())}): ${raw}`,
      );
      throw new BadRequestException(this.formatCheckoutError(raw));
    }

    return {
      clientSecret: data.client_secret,
      checkoutUrl: this.buildCheckoutUrl(data.client_secret),
      intentionId: data.id ?? '',
      orderId: data.intention_order_id ?? null,
    };
  }

  private async authBearerToken(): Promise<string> {
    const apiKey = this.legacyApiKey();
    if (!apiKey) {
      throw new BadRequestException(
        'Payment provider is not configured (missing PAYMOB_LEGACY_API_KEY)',
      );
    }

    const res = await fetch(`${this.baseUrl()}/api/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      detail?: string;
      message?: string;
    };

    if (!res.ok || !data.token) {
      const raw =
        data.detail || data.message || `Paymob auth failed (${res.status})`;
      throw new BadRequestException(
        `Paymob legacy API key is invalid. Copy the API Key from Settings → API Keys: ${raw}`,
      );
    }

    return data.token;
  }

  /** Quick Link checkout — works with UIG integration IDs when Intention API is unavailable. */
  private async createQuickLinkCheckout(
    input: CreatePaymobIntentionInput,
  ): Promise<PaymobIntentionResult> {
    const amountCents = Math.round(input.amountEgp * 100);
    if (amountCents < 100) {
      throw new BadRequestException('Minimum payment is 1 EGP');
    }

    const token = await this.authBearerToken();
    const integrationId = this.cardIntegrationId();
    const phone = input.customer.phone?.trim() || '+201000000000';
    const fullName =
      `${input.customer.firstName} ${input.customer.lastName}`.trim();

    const form = new FormData();
    form.append('amount_cents', String(amountCents));
    form.append('payment_methods', String(integrationId));
    form.append('is_live', this.isLiveMode() ? 'true' : 'false');
    form.append('full_name', fullName);
    form.append('email', input.customer.email);
    form.append('phone_number', phone);
    form.append('description', `${input.amountEgp} EGP message credits`);
    form.append('reference_id', input.specialReference);
    form.append('notification_url', input.notificationUrl);

    const res = await fetch(`${this.baseUrl()}/api/ecommerce/payment-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: number;
      client_url?: string;
      shorten_url?: string;
      order?: number;
      detail?: string;
      message?: string;
    };

    const checkoutUrl = data.client_url || data.shorten_url;
    if (!res.ok || !checkoutUrl) {
      const raw =
        data.detail ||
        data.message ||
        `Paymob quick link failed (${res.status})`;
      this.logger.warn(
        `Paymob quick link error (integration=${integrationId}): ${raw}`,
      );
      throw new BadRequestException(this.formatCheckoutError(raw));
    }

    return {
      clientSecret: checkoutUrl,
      checkoutUrl,
      intentionId: data.id != null ? String(data.id) : '',
      orderId: data.order ?? null,
    };
  }
}
