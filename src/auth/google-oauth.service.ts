import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { OAuth2Client } from 'google-auth-library';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

  /**
   * Every client id that may legitimately have minted a token for us: the web
   * client (authorization-code flow) plus the native ones Expo signs in with.
   * A token whose `aud` is none of these belongs to another app entirely.
   * Missing env vars are simply absent from the list — never blank strings,
   * which would match a token with no audience.
   */
  private get allowedAudiences(): string[] {
    return [
      this.clientId,
      process.env.GOOGLE_CLIENT_ID_IOS,
      process.env.GOOGLE_CLIENT_ID_ANDROID,
      // Android Google Sign-In returns the *web* client id as `aud` when the
      // app requests an id token via `webClientId`; keep it explicit for the
      // case where the web id is configured separately from the API's own.
      process.env.GOOGLE_CLIENT_ID_WEB,
    ]
      .map((id) => id?.trim())
      .filter((id): id is string => !!id);
  }

  private verifier: OAuth2Client | null = null;

  private get client(): OAuth2Client {
    if (!this.verifier) this.verifier = new OAuth2Client();
    return this.verifier;
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

  /** Parses Google's OAuth error JSON without logging the raw body. */
  private parseGoogleTokenError(body: string): string | null {
    try {
      const parsed = JSON.parse(body) as { error?: string };
      return typeof parsed.error === 'string' ? parsed.error : null;
    } catch {
      if (body.includes('invalid_grant')) return 'invalid_grant';
      if (body.includes('invalid_client')) return 'invalid_client';
      if (body.includes('redirect_uri_mismatch')) return 'redirect_uri_mismatch';
      return null;
    }
  }

  private messageForGoogleTokenError(error: string | null): string {
    switch (error) {
      case 'invalid_grant':
        return 'Google sign-in expired, try again';
      case 'invalid_client':
      case 'unauthorized_client':
        return 'Google sign-in is misconfigured on the server (client id/secret)';
      case 'redirect_uri_mismatch':
        return 'Google redirect URI does not match the sign-in request';
      default:
        return 'Google sign-in failed';
    }
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
      const googleError = this.parseGoogleTokenError(detail);
      // Never log the body verbatim — it can echo the secret back.
      this.logger.warn(
        `Google token exchange failed (${res.status}): ${googleError ?? 'unknown'}`,
      );
      throw new UnauthorizedException(
        this.messageForGoogleTokenError(googleError),
      );
    }

    const tokens = (await res.json()) as { id_token?: string };
    if (!tokens.id_token) {
      throw new UnauthorizedException('Google returned no identity');
    }
    return this.identityFromIdToken(tokens.id_token);
  }

  /**
   * Native apps hand us an ID token directly (no code to exchange).
   *
   * `verifyIdToken` checks Google's signature, issuer and expiry, and accepts
   * an array for `audience` — which is the fix for iOS/Android tokens being
   * rejected against the web client id alone.
   */
  async identityFromIdToken(idToken: string): Promise<GoogleIdentity> {
    if (!idToken?.trim()) throw new BadRequestException('Missing Google token');

    const audience = this.allowedAudiences;
    if (!audience.length) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(
        `Google ID token rejected: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new UnauthorizedException('Invalid Google token');
    }

    if (!payload?.email || !payload.sub) {
      throw new UnauthorizedException('Google token carried no email');
    }

    return {
      email: payload.email.trim().toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name?.trim() || null,
      picture: payload.picture ?? null,
      googleSub: payload.sub,
    };
  }
}
