import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrescriptionTemplatesService } from './prescription-templates.service';
import { PrescriptionItem } from '../entities/prescription.entity';

interface UpsertBody {
  name: string;
  title?: string;
  symptoms?: string;
  items: PrescriptionItem[];
}

@Controller('prescription-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor')
export class PrescriptionTemplatesController {
  constructor(private readonly service: PrescriptionTemplatesService) {}

  @Get()
  list(@Request() req) {
    return this.service.list(req.user.id);
  }

  @Post()
  create(@Body() body: UpsertBody, @Request() req) {
    return this.service.create(body, req.user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpsertBody, @Request() req) {
    return this.service.update(id, body, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.id);
  }
}
