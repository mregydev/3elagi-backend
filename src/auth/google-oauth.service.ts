import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
  googleSub: string;
}

/**
 * Exchanges the one-time code the browser receives for Google's ID token.
 *
 * The client secret lives here and only here — the browser never sees it, which
 * is the whole point of using the authorization-code flow instead of an
 * implicit/token flow.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  private get clientId(): string {
    return process.env.GOOGLE_CLIENT_ID ?? '';
  }

  private get clientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET ?? '';
  }

  /** Only redirect URIs registered in Google Cloud are accepted. */
  private get allowedRedirectUris(): string[] {
    return (process.env.GOOGLE_REDIRECT_URIS ?? '')
      .split(',')
      .map((uri) => uri.trim())
      .filter(Boolean);
  }

  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  async identityFromCode(
    code: string,
    redirectUri: string,
  ): Promise<GoogleIdentity> {
    if (!this.isConfigured()) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    if (!code?.trim()) throw new BadRequestException('Missing Google code');

    // An attacker-supplied redirect_uri would let a code be swapped elsewhere,
    // so it must match one this deployment declared.
    const allowed = this.allowedRedirectUris;
    if (allowed.length && !allowed.includes(redirectUri)) {
      throw new BadRequestException('Unrecognised redirect URI');
    }

    const body = new URLSearchParams({
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // Never log the body verbatim — it can echo the secret back.
      this.logger.warn(`Google token exchange failed (${res.status})`);
      if (detail.includes('invalid_grant')) {
        throw new UnauthorizedException('Google sign-in expired, try again');
      }
      throw new UnauthorizedException('Google sign-in failed');
    }

    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google returned no identity');
    }
    return this.identityFromIdToken(tokens.id_token);
  }

  /** Native apps hand us an ID token directly (no code to exchange). */
  async identityFromIdToken(idToken: string): Promise<GoogleIdentity> {
    const res = await fetch(
      `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) throw new UnauthorizedException('Invalid Google token');

    const claims = (await res.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
      exp?: string;
    };

    // Google validates the signature for us; audience and expiry are ours.
    if (claims.aud !== this.clientId) {
      throw new UnauthorizedException('Google token was issued for another app');
    }
    if (claims.exp && Number(claims.exp) * 1000 < Date.now()) {
      throw new UnauthorizedException('Google token expired');
    }
    if (!claims.email || !claims.sub) {
      throw new UnauthorizedException('Google token carried no email');
    }

    return {
      email: claims.email.trim().toLowerCase(),
      emailVerified:
        claims.email_verified === true || claims.email_verified === 'true',
      name: claims.name?.trim() || null,
      picture: claims.picture ?? null,
      googleSub: claims.sub,
    };
  }
}
