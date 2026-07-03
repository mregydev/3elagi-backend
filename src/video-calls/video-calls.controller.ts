import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateVideoCallDto } from './dto/create-video-call.dto';
import { VideoCallsService } from './video-calls.service';

@Controller('video-calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('patient', 'doctor')
export class VideoCallsController {
  constructor(private readonly videoCalls: VideoCallsService) {}

  @Post()
  initiate(
    @Request() req: { user: { id: string; role: string } },
    @Body() dto: CreateVideoCallDto,
  ) {
    if (req.user.role.toLowerCase() !== 'patient') {
      throw new ForbiddenException('Only patients can start a video call');
    }
    return this.videoCalls.initiate(req.user.id, dto);
  }

  @Get(':id')
  getOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.videoCalls.getSession(id, req.user.id);
  }

  @Post(':id/accept')
  accept(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.videoCalls.accept(id, req.user.id);
  }

  @Post(':id/decline')
  decline(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.videoCalls.decline(id, req.user.id);
  }

  @Post(':id/end')
  end(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.videoCalls.end(id, req.user.id);
  }
}
