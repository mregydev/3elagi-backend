import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import {
  resolveRequestCountry,
  type RequestLike,
} from '../common/request-country';
import { PointPricingService } from './point-pricing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AddPointsDto } from './dto/add-points.dto';
import { PointsService } from './points.service';

@Controller('points')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('doctor', 'patient')
export class PointsController {
  constructor(
    private readonly pointsService: PointsService,
    private readonly pointPricing: PointPricingService,
  ) {}

  @Get()
  getBalance(@Request() req: { user: { id: string } }) {
    return this.pointsService.getSummary(req.user.id);
  }

  /**
   * What one credit costs the caller, priced off their IP: Egypt 2 USD,
   * Jordan 15 USD, everywhere else 50 USD. Public so the price can be shown
   * before sign-in.
   */
  @Get('pricing')
  @Public()
  async pricing(@Request() req: RequestLike) {
    const country = await resolveRequestCountry(req);
    const [pricing, all] = await Promise.all([
      this.pointPricing.resolve(country),
      this.pointPricing.list(),
    ]);
    return {
      market: pricing.market,
      currency: pricing.currency,
      price_per_point: pricing.pricePerPoint,
      detected_country: country,
      // Every market, so the public pricing page can show the full table.
      markets: all.map((row) => ({
        market: row.market,
        currency: row.currency,
        price_per_point: row.pricePerPoint,
      })),
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
