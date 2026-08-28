import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { resolvePricingCountry } from '../common/request-country';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ConsultationsService } from './consultations.service';
import {
  CancelConsultationDto,
  EndConsultationDto,
  StartConsultationDto,
} from './dto/consultation.dto';

@Controller('consultations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Get('active')
  active(@Query('peer_id') peerId: string, @Request() req) {
    return this.service.findActiveWithPeer(req.user.id, peerId);
  }

  @Get('mine')
  mine(@Request() req) {
    const role = String(req.user.role ?? '').toLowerCase();
    if (role === 'doctor') {
      return this.service.listForDoctor(req.user.id);
    }
    if (role === 'patient') {
      return this.service.listForPatient(req.user.id);
    }
    throw new ForbiddenException('Not allowed');
  }

  @Post('start')
  @Roles('patient')
  async start(@Body() dto: StartConsultationDto, @Request() req) {
    // Country comes from the caller's IP, never from the client payload.
    const country = await resolvePricingCountry(req);
    return this.service.start(req.user.id, dto, country);
  }

  /** Doctor answers a pending request, optionally asking for payment first. */
  @Post(':id/accept')
  @Roles('doctor')
  async accept(
    @Param('id') id: string,
    @Body() body: { require_payment?: boolean },
    @Request() req,
  ) {
    const country = await resolvePricingCountry(req);
    return this.service.accept(
      req.user.id,
      id,
      !!body?.require_payment,
      country,
    );
  }

  /** Patient attaches the receipt for a consultation the doctor priced. */
  @Post(':id/payment-proof')
  @Roles('patient')
  submitPaymentProof(
    @Param('id') id: string,
    @Body() body: { proof_url?: string },
    @Request() req,
  ) {
    return this.service.submitPaymentProof(req.user.id, id, body?.proof_url ?? '');
  }

  /** Doctor approves or rejects that receipt. */
  @Post(':id/payment-review')
  @Roles('doctor')
  reviewPayment(
    @Param('id') id: string,
    @Body() body: { approve?: boolean },
    @Request() req,
  ) {
    return this.service.reviewPayment(req.user.id, id, !!body?.approve);
  }

  /** Either side answers a cancellation request. */
  @Post(':id/cancel-review')
  reviewCancel(
    @Param('id') id: string,
    @Body() body: { approve?: boolean },
    @Request() req,
  ) {
    return this.service.reviewCancel(req.user.id, id, !!body?.approve);
  }

  @Post(':id/reject')
  @Roles('doctor')
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    return this.service.reject(req.user.id, id, body?.reason);
  }

  @Post(':id/end')
  @Roles('doctor')
  end(
    @Param('id') id: string,
    @Body() dto: EndConsultationDto,
    @Request() req,
  ) {
    return this.service.end(req.user.id, id, dto);
  }

  @Post(':id/cancel')
  @Roles('doctor')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelConsultationDto,
    @Request() req,
  ) {
    return this.service.cancel(req.user.id, id, dto);
  }

  /** Either party removes a consultation and wipes its chat history. */
  @Post(':id/remove')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(req.user.id, id);
  }
}
