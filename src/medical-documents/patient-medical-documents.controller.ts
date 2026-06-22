import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { MedicalDocumentsService } from './medical-documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePatientMedicalDocumentDto } from './dto/create-patient-medical-document.dto';
import { DocumentType } from '../entities/medical-document.entity';

@Controller('patient/medical-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor')
export class PatientMedicalDocumentsController {
  constructor(private readonly service: MedicalDocumentsService) {}

  @Get()
  findMine(
    @Query('type') type: DocumentType.LAB | DocumentType.XRAY | undefined,
    @Request() req,
  ) {
    return this.service.findForPatientUser(req.user.id, type);
  }

  @Post()
  create(@Body() dto: CreatePatientMedicalDocumentDto, @Request() req) {
    return this.service.createForPatientUser(req.user.id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.deleteForPatientUser(id, req.user.id);
  }
}
