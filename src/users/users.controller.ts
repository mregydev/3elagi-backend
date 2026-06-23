import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { DeviceTokensService } from '../push-notifications/device-tokens.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly deviceTokens: DeviceTokensService,
  ) {}

  @Get('me')
  getMe(@Request() req: { user: { id: string } }) {
    return this.usersService.getMe(req.user.id);
  }

  @Get('contacts')
  @UseGuards(RolesGuard)
  @Roles('doctor', 'patient')
  listContacts(@Request() req: { user: { id: string } }) {
    return this.usersService.listContacts(req.user.id);
  }

  @Get('contacts/:userId')
  @UseGuards(RolesGuard)
  @Roles('doctor', 'patient', 'admin')
  getContact(
    @Request() req: { user: { id: string } },
    @Param('userId') userId: string,
  ) {
    void req;
    return this.usersService.getContactCardOrThrow(userId);
  }

  @Patch('me')
  updateMe(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(req.user.id, dto);
  }

  @Post('me/push-token')
  async registerPushToken(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.deviceTokens.register(req.user.id, dto.token);
    return { ok: true };
  }

  @Delete('me/push-token')
  async removePushToken(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterPushTokenDto,
  ) {
    await this.deviceTokens.remove(req.user.id, dto.token);
    return { ok: true };
  }
}
