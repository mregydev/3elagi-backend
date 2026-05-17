import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MedicalDocumentsService } from './medical-documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentType } from '../entities/medical-document.entity';

@Controller('medical-documents')
@UseGuards(JwtAuthGuard)
export class MedicalDocumentsController {
  constructor(private readonly service: MedicalDocumentsService) {}

  @Get('patient/:patientId')
  findByPatient(
    @Param('patientId') patientId: string,
    @Query('type') type: DocumentType,
    @Request() req,
  ) {
    return this.service.findByPatient(patientId, type, req.user.id, req.user.role);
  }

  @Post()
  create(@Body() dto: CreateDocumentDto, @Request() req) {
    return this.service.create(dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.delete(id, req.user.id, req.user.role);
  }
}
