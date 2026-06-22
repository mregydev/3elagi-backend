import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DoctorsService } from './doctors.service';
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

  @Patch('me')
  @Roles('doctor')
  updateMe(
    @Body()
    body: Partial<{
      name: string;
      age: number;
      phone: string;
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
      speciality_id: string | null;
      message_price: number;
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
