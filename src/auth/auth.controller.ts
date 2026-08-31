import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { Public } from './public.decorator';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  resolveAuthClient,
  setAuthCookies,
} from './auth-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleOAuthService,
    private readonly config: ConfigService,
  ) {}

  private clientFrom(req: ExpressRequest) {
    return resolveAuthClient(req.header('x-auth-client'));
  }

  private respondAuth(
    res: Response,
    result: Awaited<ReturnType<AuthService['authenticateUser']>>,
  ) {
    setAuthCookies(res, this.config, result.tokens);
    return result.body;
  }

  /** Web sends the one-time `code`; native apps send `id_token` instead. */
  @Post('google')
  async google_(
    @Body() dto: GoogleSignInDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const client = this.clientFrom(req);
    const code = dto.code?.trim();
    const idToken = dto.id_token?.trim();

    if (code) {
      const identity = await this.google.identityFromCode(
        code,
        dto.redirect_uri?.trim() ?? '',
      );
      const result = await this.authService.signInWithGoogle(identity, {
        medicalRecordsStorage: dto.medical_records_storage_consent,
      }, client);
      return this.respondAuth(res, result);
    }

    if (idToken) {
      const identity = await this.google.identityFromIdToken(idToken);
      const result = await this.authService.signInWithGoogle(identity, {
        medicalRecordsStorage: dto.medical_records_storage_consent,
      }, client);
      return this.respondAuth(res, result);
    }

    throw new BadRequestException('Missing Google code or token');
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, this.clientFrom(req));
    return this.respondAuth(res, result);
  }

  @Post('register/clinic')
  async registerClinic(
    @Body() dto: RegisterClinicDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerClinic(
      dto,
      this.clientFrom(req),
    );
    return this.respondAuth(res, result);
  }

  @Post('register/doctor')
  async registerDoctor(
    @Body() dto: RegisterDoctorDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerDoctor(
      dto,
      this.clientFrom(req),
    );
    return this.respondAuth(res, result);
  }

  @Post('register/patient')
  async registerPatient(
    @Body() dto: RegisterPatientDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.registerPatient(
      dto,
      this.clientFrom(req),
    );
    return this.respondAuth(res, result);
  }

  @Post('verify-email')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto, this.clientFrom(req));
    return this.respondAuth(res, result);
  }

  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Body() body: { refresh_token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const client = this.clientFrom(req);
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] ?? body?.refresh_token;
    const result = await this.authService.refreshSession(refreshToken, client);
    setAuthCookies(res, this.config, result.tokens);
    return {
      ...result.body,
      access_token: result.tokens.accessToken,
    };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: ExpressRequest,
    @Body() body: { refresh_token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] ?? body?.refresh_token;
    await this.authService.logout(refreshToken);
    clearAuthCookies(res, this.config);
    return { ok: true };
  }

  @Get('access-token')
  @Public()
  accessToken(@Req() req: ExpressRequest) {
    return this.authService.accessTokenForWebSocket(
      req.cookies?.[ACCESS_TOKEN_COOKIE],
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Request() req: { user: { id: string } },
    @Body() body: { current_password: string; new_password: string },
  ) {
    return this.authService.changePassword(
      req.user.id,
      body?.current_password,
      body?.new_password,
    );
  }
}
