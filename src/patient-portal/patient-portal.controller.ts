import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PatientPortalService } from './patient-portal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class PatientPortalController {
  constructor(private readonly service: PatientPortalService) {}

  @Get('public/doctors')
  listDoctors() {
    return this.service.listDoctors();
  }

  @Get('public/doctors/:id')
  getDoctor(@Param('id') id: string) {
    return this.service.getDoctor(id);
  }

  @Get('public/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  me(@Request() req) {
    return this.service.getMe(req.user.id);
  }

  @Patch('public/me/onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  saveOnboarding(@Body() body: any, @Request() req) {
    return this.service.saveOnboarding(req.user.id, body);
  }

  @Get('public/onboarding-intake')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  getOnboardingIntake() {
    return this.service.getOnboardingIntake();
  }

  @Post('public/reservations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  reserve(@Body() body: any, @Request() req) {
    return this.service.createReservation(req.user.id, body);
  }

  @Get('public/me/reservations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  myReservations(@Request() req) {
    return this.service.myReservations(req.user.id);
  }

  @Patch('public/me/reservations/:id/hide-name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  setHideName(
    @Param('id') id: string,
    @Body() body: { hide_name: boolean },
    @Request() req,
  ) {
    return this.service.setHideName(req.user.id, id, !!body?.hide_name);
  }
}
