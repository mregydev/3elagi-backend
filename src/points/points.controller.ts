import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AddPointsDto } from './dto/add-points.dto';
import { PointsService } from './points.service';

@Controller('points')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor', 'patient')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get()
  getBalance(@Request() req: { user: { id: string } }) {
    return this.pointsService.getSummary(req.user.id);
  }

  @Post('add')
  addPoints(
    @Request() req: { user: { id: string } },
    @Body() dto: AddPointsDto,
  ) {
    return this.pointsService.addPoints(req.user.id, dto.amount);
  }

  @Post('reimburse')
  @Roles('doctor')
  reimburse(@Request() req: { user: { id: string } }) {
    return this.pointsService.reimburse(req.user.id);
  }
}
