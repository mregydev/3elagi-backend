import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateWherebyMeetingDto } from './dto/create-whereby-meeting.dto';
import { WherebyService } from './whereby.service';

@Controller('whereby')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor')
export class WherebyController {
  constructor(private readonly whereby: WherebyService) {}

  @Post('meetings')
  create(
    @Request() req: { user: { id: string; role: string } },
    @Body() dto: CreateWherebyMeetingDto,
  ) {
    return this.whereby.createMeeting(req.user.id, req.user.role, dto);
  }
}
