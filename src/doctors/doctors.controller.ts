import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { DoctorOnboardingService } from '../doctor-onboarding/doctor-onboarding.service';
import { TestPatientAiService } from '../doctor-onboarding/test-patient-ai.service';
import { DEFAULT_TEST_PATIENT_DISPLAY_NAME } from '../doctor-onboarding/specialty-test.constants';
import { ReviewsService } from '../reviews/reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(
    private readonly doctorsService: DoctorsService,
    private readonly reviewsService: ReviewsService,
    private readonly doctorOnboarding: DoctorOnboardingService,
    private readonly testPatientAi: TestPatientAiService,
  ) {}

  @Get('clinic/:clinicId')
  @Public()
  findByClinic(@Param('clinicId') clinicId: string) {
    return this.doctorsService.findByClinic(clinicId);
  }

  @Get('me')
  @Roles('doctor')
  findMe(@Request() req) {
    return this.doctorsService.findByUserId(req.user.id);
  }

  @Get('me/reviews')
  @Roles('doctor')
  getMyReviews(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const p = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const l = Math.max(1, parseInt(limit ?? '10', 10) || 10);
    return this.reviewsService.listForDoctorUser(req.user.id, p, l);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Request() req) {
    return this.doctorsService.findById(id, req.user.id, req.user.role);
  }

  @Patch('me/tours')
  @Roles('doctor')
  completeTour(
    @Body() body: { kind: 'product' | 'profile' },
    @Request() req,
  ) {
    return this.doctorOnboarding.markTourComplete(req.user.id, body.kind);
  }

  @Post('me/onboarding')
  @Roles('doctor')
  ensureOnboarding(@Request() req) {
    return this.doctorsService.ensureOnboarding(req.user.id);
  }

  @Get('me/demo-patient')
  @Roles('doctor')
  async demoPatient(@Request() req) {
    const patientUserId = await this.testPatientAi.resolveDemoPatientUserIdForDoctor(
      req.user.id,
    );
    if (!patientUserId) {
      return { patient_user_id: null, chat_open: false };
    }
    await this.testPatientAi.ensureDoctorCanChatWithTestPatient(
      req.user.id,
      patientUserId,
    );
    return {
      patient_user_id: patientUserId,
      chat_open: true,
      display_name: DEFAULT_TEST_PATIENT_DISPLAY_NAME,
    };
  }

  @Get('me/test-patient-chat/:patientUserId')
  @Roles('doctor')
  testPatientChatStatus(
    @Request() req,
    @Param('patientUserId') patientUserId: string,
  ) {
    return this.testPatientAi.getChatStatus(req.user.id, patientUserId);
  }

  @Patch('me')
  @Roles('doctor')
  updateMe(
    @Body()
    body: Partial<{
      name: string;
      age: number;
      phone: string;
      country: string;
      email: string;
      photo_url: string;
      graduation_cert_url: string;
      work_permit_url: string;
      digital_signature_url: string;
      personal_clinic_location: string;
      professional_title: string | null;
      description: string | null;
      experience_years: number | null;
      consultation_fee_egp: number | null;
      faqs: { id: string; q: string; a: string }[];
      tags: string[];
      certification_urls: { url: string; description: string }[];
      speciality_id: string | null;
      /** Full set the doctor practises; first one becomes the primary. */
      speciality_ids: string[];
      consultation_price: number;
      video_consultation_price: number;
      video_consultation_minutes: number;
      immediate_call_enabled: boolean;
      /** Cash fees: home currency for local patients, USD for everyone else. */
      text_price_local: number | null;
      text_price_usd: number | null;
      video_price_local: number | null;
      video_price_usd: number | null;
      payment_link: string | null;
      iban: string | null;
      account_holder_full_name: string | null;
      national_id: string | null;
    }>,
    @Request() req,
  ) {
    return this.doctorsService.updateSelf(req.user.id, body);
  }

  @Delete('clinic/:clinicId/:doctorId')
  @Public()
  removeFromClinic(
    @Param('clinicId') clinicId: string,
    @Param('doctorId') doctorId: string,
  ) {
    return this.doctorsService.removeFromClinic(doctorId, clinicId);
  }
}
