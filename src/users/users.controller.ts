import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Patch('me')
  updateMe(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateMe(req.user.id, dto);
  }
}
