import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { countryFromRequest } from '../common/request-country';
import { resolveMarketPricing } from './market-pricing.constants';
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

  /**
   * What one credit costs the caller, priced off their IP: Egypt in EGP,
   * Jordan in JOD, everywhere else in USD. Public so the price can be shown
   * before sign-in.
   */
  @Get('pricing')
  @Public()
  pricing(@Request() req: { headers: Record<string, string | string[] | undefined> }) {
    const country = countryFromRequest(req.headers);
    const pricing = resolveMarketPricing(country);
    return {
      market: pricing.market,
      currency: pricing.currency,
      price_per_point: pricing.pricePerPoint,
      detected_country: country,
    };
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
