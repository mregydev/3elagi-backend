import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterClinicDto } from './dto/register-clinic.dto';
import { RegisterDoctorDto } from './dto/register-doctor.dto';
import { RegisterPatientDto } from './dto/register-patient.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';

class GoogleSignInDto {
  code?: string;
  redirect_uri?: string;
  id_token?: string;
  /** GDPR: required the first time an account is created via Google. */
  medical_records_storage_consent?: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly google: GoogleOAuthService,
  ) {}

  /** Web sends the one-time `code`; native apps send `id_token` instead. */
  @Post('google')
  async google_(@Body() dto: GoogleSignInDto) {
    const identity = dto.code
      ? await this.google.identityFromCode(dto.code, dto.redirect_uri ?? '')
      : await this.google.identityFromIdToken(dto.id_token ?? '');
    return this.authService.signInWithGoogle(identity, {
      medicalRecordsStorage: dto.medical_records_storage_consent,
    });
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('register/clinic')
  registerClinic(@Body() dto: RegisterClinicDto) {
    return this.authService.registerClinic(dto);
  }

  @Post('register/doctor')
  registerDoctor(@Body() dto: RegisterDoctorDto) {
    return this.authService.registerDoctor(dto);
  }

  @Post('register/patient')
  registerPatient(@Body() dto: RegisterPatientDto) {
    return this.authService.registerPatient(dto);
  }

  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
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
