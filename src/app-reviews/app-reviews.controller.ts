import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppReviewsService } from './app-reviews.service';

@Controller('app-reviews')
@UseGuards(JwtAuthGuard)
export class AppReviewsController {
  constructor(private readonly service: AppReviewsService) {}

  @Get('mine')
  mine(@Request() req: { user: { id: string } }) {
    return this.service.findMine(req.user.id);
  }

  @Post()
  submit(
    @Request()
    req: {
      user: { id: string; email?: string; role?: string; name?: string };
    },
    @Body()
    body: {
      rating?: number;
      comment?: string;
      improvement_tags?: string[];
    },
  ) {
    return this.service.submit(req.user, {
      rating: Number(body?.rating),
      comment: body?.comment,
      improvementTags: body?.improvement_tags,
    });
  }
}
