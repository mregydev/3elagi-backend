import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MedicalDocumentsService } from './medical-documents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePatientMedicalDocumentDto } from './dto/create-patient-medical-document.dto';
import { UpdatePatientMedicalDocumentDto } from './dto/update-patient-medical-document.dto';
import { DocumentType } from '../entities/medical-document.entity';
import { UploadsService } from '../uploads/uploads.service';
import { resolveApiLocale } from '../common/resolve-api-locale';

const MEDICAL_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

/**
 * Patient portal medical documents.
 * Patients may list/create/update lab, xray, and prescription records.
 * Diagnoses are never created here — doctors use POST /diagnosis.
 */
@Controller('patient/medical-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor')
export class PatientMedicalDocumentsController {
  constructor(
    private readonly service: MedicalDocumentsService,
    private readonly uploads: UploadsService,
  ) {}

  @Get()
  findMine(
    @Query('type') type: DocumentType.LAB | DocumentType.XRAY | undefined,
    @Request() req,
  ) {
    return this.service.findForPatientUser(req.user.id, type);
  }

  @Post()
  create(@Body() dto: CreatePatientMedicalDocumentDto, @Request() req) {
    return this.service.createForPatientUser(req.user.id, req.user.role, dto);
  }

  @Post('analyze-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (MEDICAL_IMAGE_MIMES.has(mime) || mime.startsWith('image/')) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Unsupported file type'), false);
      },
    }),
  )
  analyzeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string | undefined,
    @Query('lang') lang: 'ar' | 'en' | undefined,
    @Request() req,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    const outputLang = resolveApiLocale(lang);
    return this.service.analyzeImageBuffer(
      file.buffer,
      file.mimetype || 'image/jpeg',
      outputLang,
      { titleHint: typeof title === 'string' ? title : undefined },
    );
  }

  @Post('from-image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (MEDICAL_IMAGE_MIMES.has(mime) || mime.startsWith('image/')) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Unsupported file type'), false);
      },
    }),
  )
  async createFromImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string | undefined,
    @Query('lang') lang: 'ar' | 'en' | undefined,
    @Query('generate_insight') generateInsight: string | undefined,
    @Request() req,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    const outputLang = resolveApiLocale(lang);
    const includeInsight = generateInsight !== 'false';
    const analyzed = await this.service.analyzeImageBuffer(
      file.buffer,
      file.mimetype || 'image/jpeg',
      outputLang,
      {
        includeInsight,
        titleHint: typeof title === 'string' ? title : undefined,
      },
    );
    const uploaded = await this.uploads.uploadFile(file);
    const fileUrl = uploaded.url || uploaded.objectPath;
    return this.service.createFromAnalyzedImage({
      userId: req.user.id,
      role: req.user.role,
      fileUrl,
      fileName: file.originalname || 'medical-record.jpg',
      analyzed,
      includeInsight,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOneForPatientUser(id, req.user.id);
  }

  // NestJS can't stack route-method decorators on one handler (metadata
  // collides), so the POST alias needs its own method delegating here.
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientMedicalDocumentDto,
    @Request() req,
  ) {
    return this.service.updateForPatientUser(
      id,
      req.user.id,
      req.user.role,
      dto,
    );
  }

  @Post(':id/update')
  updateViaPost(
    @Param('id') id: string,
    @Body() dto: UpdatePatientMedicalDocumentDto,
    @Request() req,
  ) {
    return this.update(id, dto, req);
  }

  @Post(':id/generate-details')
  generateDetails(
    @Param('id') id: string,
    @Query('lang') lang: 'ar' | 'en' | undefined,
    @Request() req,
  ) {
    const outputLang = resolveApiLocale(lang);
    return this.service.generateDetailsForDocument(
      id,
      req.user.id,
      req.user.role,
      outputLang,
    );
  }

  @Post(':id/generate-insight')
  generateInsight(
    @Param('id') id: string,
    @Query('lang') lang: 'ar' | 'en' | undefined,
    @Request() req,
  ) {
    const outputLang = resolveApiLocale(lang);
    return this.service.generateInsightForDocument(id, req.user.id, outputLang);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req) {
    return this.service.deleteForPatientUser(id, req.user.id);
  }
}
