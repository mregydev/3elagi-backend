import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { resolveApiLocale } from '../common/resolve-api-locale';
import { MedicalDocumentRequestsService } from './medical-document-requests.service';
import { CreateMedicalDocumentRequestDto } from './dto/create-medical-document-request.dto';
import { AiDraftRequestDescriptionDto } from './dto/ai-draft-request-description.dto';

@Controller('medical-document-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
export class MedicalDocumentRequestsController {
  constructor(private readonly service: MedicalDocumentRequestsService) {}

  @Post()
  create(@Body() dto: CreateMedicalDocumentRequestDto, @Request() req) {
    return this.service.createForPatient(dto, req.user.id);
  }

  @Post('ai-draft-description')
  aiDraftDescription(@Body() dto: AiDraftRequestDescriptionDto, @Request() req) {
    return this.service.draftDescription(dto, req.user.id);
  }

  @Get('patient/:patientUserId')
  listForPatient(@Param('patientUserId') patientUserId: string, @Request() req) {
    return this.service.listForPatientAsDoctor(patientUserId, req.user.id);
  }

  @Get(':id/pdf')
  getPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('regenerate') regenerate: string | undefined,
    @Request() req,
  ) {
    return this.service.getOrGeneratePdfForDoctor(id, req.user.id, {
      lang: resolveApiLocale(lang),
      regenerate: regenerate === 'true',
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOneForDoctor(id, req.user.id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req) {
    return this.service.cancel(id, req.user.id);
  }
}
