import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ComplaintsService } from './complaints.service';
import { FileComplaintDto, ResolveComplaintDto } from './dto/complaint.dto';

@Controller('complaints')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplaintsController {
  constructor(private readonly service: ComplaintsService) {}

  @Post()
  @Roles('patient')
  file(@Body() dto: FileComplaintDto, @Request() req) {
    return this.service.file(req.user.id, dto);
  }

  @Get('status')
  @Roles('patient')
  status(@Query('consultation_id') consultationId: string) {
    return this.service.statusFor(consultationId);
  }

  @Get()
  @Roles('admin')
  list() {
    return this.service.listAll();
  }

  @Get(':id/messages')
  @Roles('admin')
  messages(@Param('id') id: string) {
    return this.service.messagesFor(id);
  }

  @Post(':id/resolve')
  @Roles('admin')
  resolve(@Param('id') id: string, @Body() dto: ResolveComplaintDto) {
    return this.service.resolve(id, dto);
  }
}
