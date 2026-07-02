import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
  CreatePrescriptionForUserDto,
  PrescriptionsService,
} from './prescriptions.service';
import { PrescriptionItem } from '../entities/prescription.entity';

const PRESCRIPTION_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

@Controller('prescriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrescriptionsController {
  constructor(private readonly service: PrescriptionsService) {}

  @Get('patient/:patientId')
  list(@Param('patientId') patientId: string, @Request() req) {
    return this.service.listForPatient(patientId, req.user.id, req.user.role);
  }

  @Get('patient-user/:patientUserId')
  listForPatientUser(@Param('patientUserId') patientUserId: string, @Request() req) {
    return this.service.listForPatientUser(
      patientUserId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('patient-user/:patientUserId/:id')
  findOneForPatientUser(
    @Param('patientUserId') patientUserId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.service.findOneForPatientUser(id, req.user.id, req.user.role);
  }

  @Post('patient-user/:patientUserId/:id/generate-insight')
  @Roles('doctor', 'patient')
  generateInsight(
    @Param('id') id: string,
    @Query('lang') lang: 'ar' | 'en' | undefined,
    @Request() req,
  ) {
    const outputLang = lang === 'ar' ? 'ar' : 'en';
    return this.service.generateInsightForPatientUser(
      id,
      req.user.id,
      req.user.role,
      outputLang,
    );
  }

  @Get('template')
  @Roles('doctor')
  template(@Query('title') title: string, @Request() req) {
    return this.service.getTemplate(title, req.user.id);
  }

  @Get('diseases')
  @Roles('doctor')
  diseases(@Query('q') q: string, @Request() req) {
    return this.service.searchDiseases(q ?? '', req.user.id);
  }

  @Post('analyze-image')
  @Roles('doctor', 'patient')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype || '').toLowerCase();
        if (PRESCRIPTION_IMAGE_MIMES.has(mime) || mime.startsWith('image/')) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Only image files are allowed'), false);
      },
    }),
  )
  analyzeImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('lang') lang: string | undefined,
    @Request() req,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    const outputLang: 'ar' | 'en' = lang?.trim().toLowerCase() === 'ar' ? 'ar' : 'en';
    return this.service.analyzeImageBuffer(
      req.user.id,
      file.buffer,
      file.mimetype || 'image/jpeg',
      outputLang,
    );
  }

  @Post('patient-user')
  @Roles('doctor', 'patient')
  createForPatientUser(@Body() body: CreatePrescriptionForUserDto, @Request() req) {
    return this.service.createForPatientUser(body, req.user.id, req.user.role);
  }

  @Post()
  @Roles('doctor')
  create(
    @Body()
    body: {
      patient_id: string;
      title: string;
      symptoms?: string;
      items: PrescriptionItem[];
      lang?: 'ar' | 'en';
    },
    @Request() req,
  ) {
    return this.service.create(body, req.user.id);
  }
}
