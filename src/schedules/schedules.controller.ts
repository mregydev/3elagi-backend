import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { ScheduleOverrideScope } from '../entities/doctor-schedule-override.entity';

interface ScheduleInput {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active?: boolean;
}

interface OverrideInput {
  id?: string;
  scope: ScheduleOverrideScope;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  start_time?: string | null;
  end_time?: string | null;
  slot_minutes?: number | null;
  note?: string | null;
}

@Controller()
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Get('schedules/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  listMine(@Request() req) {
    return this.service.listMine(req.user.id);
  }

  @Put('schedules/me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  replaceMine(@Body() body: { items: ScheduleInput[] }, @Request() req) {
    return this.service.replaceMine(req.user.id, body?.items ?? []);
  }

  @Get('schedules/me/overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  listMyOverrides(@Request() req) {
    return this.service.listMyOverrides(req.user.id);
  }

  @Put('schedules/me/overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  replaceMyOverrides(
    @Body() body: { items: OverrideInput[] },
    @Request() req,
  ) {
    return this.service.replaceMyOverrides(req.user.id, body?.items ?? []);
  }

  @Get('public/doctors/:id/slots')
  publicSlots(@Param('id') id: string, @Query('date') date: string) {
    return this.service.availableSlots(id, date);
  }
}
