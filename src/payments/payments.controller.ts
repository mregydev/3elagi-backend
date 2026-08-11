import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateCardCheckoutDto } from './dto/create-card-checkout.dto';
import {
  resolveRequestCountry,
  type RequestLike,
} from '../common/request-country';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('credits/checkout/visa')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'patient')
  async createVisaCheckout(
    @Request() req: RequestLike & { user: { id: string } },
    @Body() dto: CreateCardCheckoutDto,
  ) {
    // Price off where the payer actually is, falling back to their profile.
    return this.payments.createCardCheckout(
      req.user.id,
      dto.amount,
      await resolveRequestCountry(req),
    );
  }

  @Get('config-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor', 'patient')
  configCheck() {
    return this.payments.paymentConfigCheck();
  }

  @Post('paymob/webhook')
  async paymobWebhook(
    @Body() body: Record<string, unknown>,
    @Query('hmac') hmac: string | undefined,
  ) {
    await this.payments.handlePaymobWebhook(body, hmac);
    return { received: true };
  }

  @Get('paymob/return')
  paymobReturn(
    @Query('success') success: string | undefined,
    @Query('txn_response_code') txnCode: string | undefined,
    @Res() res: Response,
  ) {
    const ok =
      success === 'true' ||
      success === 'True' ||
      txnCode === 'APPROVED' ||
      txnCode === '00';
    res.type('html').send(this.payments.buildReturnHtml(ok));
  }
}
