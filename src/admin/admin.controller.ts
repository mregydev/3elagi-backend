import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { AdminService } from './admin.service';
import { PointPricingService } from '../points/point-pricing.service';
import { ContactService } from '../contact/contact.service';
import { DoctorRegistrationRequestsService } from '../doctor-registration-requests/doctor-registration-requests.service';
import { AppReviewsService } from '../app-reviews/app-reviews.service';
import type { PointMarket } from '../entities/point-pricing.entity';
import { TrainRagDocumentChunkDto } from './dto/train-rag-document-chunk.dto';
import { SendMarketingEmailDto, MARKETING_EMAIL_LANGUAGES } from './dto/send-marketing-email.dto';
import { SendMarketingEmailBatchDto } from './dto/send-marketing-email-batch.dto';
import { resolveMarketingEmailTheme } from '../mail/marketing-email-themes';
import { IntakeQuestion } from '../entities/intake-test.entity';
import type { ApprovalStatus } from '../entities/doctor.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly pointPricing: PointPricingService,
    private readonly contactService: ContactService,
    private readonly doctorRegistrationRequests: DoctorRegistrationRequestsService,
    private readonly appReviews: AppReviewsService,
  ) {}

  @Get('stats')
  stats() {
    return this.service.stats();
  }

  // Specialities (market visibility)
  @Get('specialities')
  listSpecialities() {
    return this.service.listSpecialities();
  }
  @Patch('specialities/:id/visibility')
  updateSpecialityVisibility(
    @Param('id') id: string,
    @Body() body: { visible_eg?: boolean; visible_jo?: boolean },
  ) {
    return this.service.updateSpecialityVisibility(id, body ?? {});
  }

  // Doctors
  @Get('doctors')
  listDoctors() {
    return this.service.listDoctors();
  }
  @Patch('doctors/:id')
  updateDoctor(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      age?: number;
      email?: string;
      photo_url?: string;
      professional_title?: string | null;
      description?: string | null;
      experience_years?: number | null;
      consultation_fee_egp?: number | null;
    },
  ) {
    return this.service.updateDoctor(id, body);
  }
  @Patch('doctors/:id/approval')
  setDoctorApproval(
    @Param('id') id: string,
    @Body() body: { status: ApprovalStatus },
  ) {
    return this.service.setDoctorApproval(id, body?.status);
  }
  @Delete('doctors/:id')
  deleteDoctor(@Param('id') id: string) {
    return this.service.deleteDoctor(id);
  }

  // Clinics
  @Get('clinics')
  listClinics() {
    return this.service.listClinics();
  }
  @Patch('clinics/:id/approval')
  setClinicApproval(
    @Param('id') id: string,
    @Body() body: { status: ApprovalStatus },
  ) {
    return this.service.setClinicApproval(id, body?.status);
  }

  // Patients
  @Get('patients')
  listPatients() {
    return this.service.listPatients();
  }
  @Patch('patients/:userId')
  updatePatient(
    @Param('userId') userId: string,
    @Body()
    body: {
      name?: string;
      phone?: string;
      birth_date?: string | null;
      gender?: string | null;
      chronic_conditions?: string | null;
      allergies?: string | null;
      medical_notes?: string | null;
    },
  ) {
    return this.service.updatePatient(userId, body);
  }
  @Delete('patients/:userId')
  deletePatient(@Param('userId') userId: string) {
    return this.service.deletePatient(userId);
  }

  // Default intake template
  @Get('default-intake-test')
  getDefaultIntake() {
    return this.service.getDefaultIntake();
  }
  @Put('default-intake-test')
  upsertDefaultIntake(
    @Body()
    body: {
      name: string;
      description?: string;
      is_active?: boolean;
      questions: IntakeQuestion[];
    },
  ) {
    return this.service.upsertDefaultIntake(body);
  }

  @Get('rag-sources')
  listRagSources() {
    return this.service.listRagSources();
  }

  @Put('rag-sources/text')
  createRagText(
    @Request() req: { user: { id: string } },
    @Body() body: { title?: string; content?: string },
  ) {
    return this.service.createRagText(req.user.id, body);
  }

  @Put('rag-sources/document')
  createRagDocument(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      title?: string;
      file_url?: string;
      file_name?: string;
      mime_type?: string;
    },
  ) {
    return this.service.createRagDocument(req.user.id, body);
  }

  @Put('rag-sources/document/train')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 },
    }),
  )
  trainRagDocumentFile(
    @Request() req: { user: { id: string } },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string },
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }
    return this.service.trainRagDocument(req.user.id, file.buffer, {
      title: body.title,
      file_name: file.originalname,
      mime_type: file.mimetype,
    });
  }

  @Put('rag-sources/document/train-chunk')
  trainRagDocumentChunk(
    @Request() req: { user: { id: string } },
    @Body() body: TrainRagDocumentChunkDto,
  ) {
    return this.service.trainRagDocumentFromChunk(req.user.id, body);
  }

  @Delete('rag-sources/:id')
  deleteRagSource(@Param('id') id: string) {
    return this.service.deleteRagSource(id);
  }

  @Get('marketing/template/:language')
  getMarketingTemplate(
    @Param('language') language: string,
    @Query('theme') theme?: string,
  ) {
    const normalized = language.trim().toLowerCase();
    if (
      !MARKETING_EMAIL_LANGUAGES.includes(
        normalized as (typeof MARKETING_EMAIL_LANGUAGES)[number],
      )
    ) {
      throw new HttpException('Invalid language', HttpStatus.BAD_REQUEST);
    }
    return this.service.getMarketingTemplate(
      normalized as (typeof MARKETING_EMAIL_LANGUAGES)[number],
      resolveMarketingEmailTheme(theme),
    );
  }

  @Post('marketing/send')
  sendMarketingEmail(@Body() body: SendMarketingEmailDto) {
    return this.service.sendMarketingEmail(body);
  }

  @Post('marketing/send-batch')
  sendMarketingEmailBatch(@Body() body: SendMarketingEmailBatchDto) {
    return this.service.sendMarketingEmailBatch(body);
  }

  @Post('sendNotf')
  @Public()
  @Roles()
  sendNotf() {
    return this.service.sendNotf();
  }

  /** Cash price of one credit per market (Egypt, Jordan, rest of world). */
  @Get('point-pricing')
  listPointPricing() {
    return this.pointPricing.list();
  }

  @Patch('point-pricing/:market')
  setPointPricing(
    @Param('market') market: string,
    @Body() body: { price_per_point?: number },
  ) {
    return this.pointPricing.setPrice(
      market.toUpperCase() as PointMarket,
      Number(body?.price_per_point),
    );
  }

  @Get('contact-messages')
  listContactMessages() {
    return this.contactService.listForAdmin();
  }

  @Get('contact-messages/:id')
  getContactMessage(@Param('id') id: string) {
    return this.contactService.findOneForAdmin(id);
  }

  @Patch('contact-messages/:id/read')
  markContactMessageRead(
    @Param('id') id: string,
    @Body() body: { read?: boolean },
  ) {
    return this.contactService.markRead(id, body?.read !== false);
  }

  @Get('doctor-registrations')
  listDoctorRegistrations() {
    return this.doctorRegistrationRequests.listForAdmin();
  }

  @Get('doctor-registrations/:id')
  getDoctorRegistration(@Param('id') id: string) {
    return this.doctorRegistrationRequests.findOneForAdmin(id);
  }

  @Patch('doctor-registrations/:id/read')
  markDoctorRegistrationRead(
    @Param('id') id: string,
    @Body() body: { read?: boolean },
  ) {
    return this.doctorRegistrationRequests.markRead(id, body?.read !== false);
  }

  @Get('app-reviews')
  listAppReviews() {
    return this.appReviews.listForAdmin();
  }

  @Get('app-reviews/:id')
  getAppReview(@Param('id') id: string) {
    return this.appReviews.findOneForAdmin(id);
  }

  @Patch('app-reviews/:id/read')
  markAppReviewRead(
    @Param('id') id: string,
    @Body() body: { read?: boolean },
  ) {
    return this.appReviews.markRead(id, body?.read !== false);
  }
}
