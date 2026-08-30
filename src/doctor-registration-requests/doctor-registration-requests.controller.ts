import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DoctorRegistrationRequestsService } from './doctor-registration-requests.service';

@Controller('doctor-registration-requests')
export class DoctorRegistrationRequestsController {
  constructor(private readonly service: DoctorRegistrationRequestsService) {}

  @Post()
  @Public()
  submit(
    @Body()
    body: {
      doctor_name?: string;
      email?: string;
      phone?: string;
      speciality_id?: string;
    },
  ) {
    return this.service.submit({
      doctorName: body.doctor_name ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      specialityId: body.speciality_id ?? '',
    });
  }
}
