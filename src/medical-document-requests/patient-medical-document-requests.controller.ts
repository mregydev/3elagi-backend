import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { resolveApiLocale } from '../common/resolve-api-locale';
import { MedicalDocumentRequestsService } from './medical-document-requests.service';
import { FulfillMedicalDocumentRequestDto } from './dto/fulfill-medical-document-request.dto';

@Controller('patient/medical-document-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient')
export class PatientMedicalDocumentRequestsController {
  constructor(private readonly service: MedicalDocumentRequestsService) {}

  @Get()
  findMine(@Request() req) {
    return this.service.listForPatientUser(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOneForPatientUser(id, req.user.id);
  }

  @Post(':id/fulfill')
  fulfill(
    @Param('id') id: string,
    @Body() dto: FulfillMedicalDocumentRequestDto,
    @Request() req,
  ) {
    return this.service.fulfill(id, req.user.id, dto.document_id);
  }

  @Get(':id/pdf')
  getPdf(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Query('regenerate') regenerate: string | undefined,
    @Request() req,
  ) {
    return this.service.getOrGeneratePdfForPatientUser(id, req.user.id, {
      lang: resolveApiLocale(lang),
      regenerate: regenerate === 'true',
    });
  }
}
