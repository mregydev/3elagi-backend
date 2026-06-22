import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DoctorPatientAccessService } from './doctor-patient-access.service';

@Controller('doctor-patient-access')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor', 'patient')
export class DoctorPatientAccessController {
  constructor(private readonly service: DoctorPatientAccessService) {}

  @Get('with/:peerId')
  getWithPeer(
    @Request() req: { user: { id: string } },
    @Param('peerId') peerId: string,
  ) {
    return this.service.getStatusForPeer(req.user.id, peerId);
  }
}
