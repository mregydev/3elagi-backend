import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @Get('public/doctors/:id/reviews')
  list(@Param('id') id: string) {
    return this.service.list(id);
  }

  @Post('public/doctors/:id/reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  create(
    @Param('id') id: string,
    @Body() body: { rating: number; comment?: string | null },
    @Request() req,
  ) {
    return this.service.create(id, req.user.id, body);
  }
}
