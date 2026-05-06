import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('doctors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Get('clinic/:clinicId')
  @Roles('clinic_admin')
  findByClinic(@Param('clinicId') clinicId: string, @Request() req) {
    return this.doctorsService.findByClinic(clinicId, req.user.id);
  }

  @Get('me')
  @Roles('doctor')
  findMe(@Request() req) {
    return this.doctorsService.findByUserId(req.user.id);
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
    }>,
    @Request() req,
  ) {
    return this.doctorsService.updateSelf(req.user.id, body);
  }

  @Delete('clinic/:clinicId/:doctorId')
  @Roles('clinic_admin')
  removeFromClinic(
    @Param('clinicId') clinicId: string,
    @Param('doctorId') doctorId: string,
    @Request() req,
  ) {
    return this.doctorsService.removeFromClinic(doctorId, clinicId, req.user.id);
  }
}
