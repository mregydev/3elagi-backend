import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unread') unread?: string,
  ) {
    return this.service.listForUser(
      req.user.id,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
      unread === '1' || unread === 'true',
    );
  }

  @Get('unread-count')
  async unreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.service.unreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  markRead(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.markRead(req.user.id, id);
  }

  @Post('read-all')
  markAllRead(@Request() req: { user: { id: string } }) {
    return this.service.markAllRead(req.user.id);
  }
}
