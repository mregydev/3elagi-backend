import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../auth/public.decorator';
import { isAllowedUploadMime } from '../uploads/uploads.service';
import { DoctorRegistrationRequestsService } from './doctor-registration-requests.service';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

@Controller('doctor-registration-requests')
export class DoctorRegistrationRequestsController {
  constructor(private readonly service: DoctorRegistrationRequestsService) {}

  @Post()
  @Public()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES },
      fileFilter: (_req, file, cb) => {
        if (isAllowedUploadMime(file.mimetype) && file.mimetype.startsWith('image/')) {
          cb(null, true);
          return;
        }
        cb(new BadRequestException('Profile photo must be an image (JPEG, PNG, or WebP)'), false);
      },
    }),
  )
  submit(
    @Body()
    body: {
      doctor_name?: string;
      email?: string;
      phone?: string;
      country?: string;
      speciality_id?: string;
      clinic_location?: string;
    },
    @UploadedFile() photo: Express.Multer.File | undefined,
  ) {
    if (!photo?.buffer?.length) {
      throw new BadRequestException('Profile photo is required');
    }
    return this.service.submit({
      doctorName: body.doctor_name ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      country: body.country ?? '',
      specialityId: body.speciality_id ?? '',
      clinicLocation: body.clinic_location ?? '',
      photo,
    });
  }
}
