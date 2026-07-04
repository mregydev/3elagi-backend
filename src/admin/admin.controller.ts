import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';
import { IntakeQuestion } from '../entities/intake-test.entity';
import type { ApprovalStatus } from '../entities/doctor.entity';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('stats')
  stats() {
    return this.service.stats();
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

  @Delete('rag-sources/:id')
  deleteRagSource(@Param('id') id: string) {
    return this.service.deleteRagSource(id);
  }

  @Post('sendNotf')
  sendNotf() {
    return this.service.sendNotf();
  }
}
