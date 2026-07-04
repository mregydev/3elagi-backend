import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { IntakeExamsService } from './intake-exams.service';
import { AssignIntakeExamDto } from './dto/assign-intake-exam.dto';
import { SaveIntakeExamAnswersDto } from './dto/save-intake-exam-answers.dto';

@Controller('intake-exams')
export class IntakeExamsController {
  constructor(private readonly service: IntakeExamsService) {}

  @Post('assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('doctor')
  assign(
    @Request() req: { user: { id: string } },
    @Body() dto: AssignIntakeExamDto,
  ) {
    return this.service.assignExam(req.user.id, dto);
  }

  @Get('patient/:patientUserId')
  @UseGuards(JwtAuthGuard)
  listForPatient(
    @Request() req: { user: { id: string; role: string } },
    @Param('patientUserId') patientUserId: string,
  ) {
    return this.service.listForPatientUser(
      patientUserId,
      req.user.id,
      req.user.role,
    );
  }

  @Get('instances/:id')
  @UseGuards(JwtAuthGuard)
  getInstance(
    @Request() req: { user: { id: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.service.getInstance(id, req.user.id, req.user.role);
  }

  @Patch('instances/:id/answers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  saveAnswers(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: SaveIntakeExamAnswersDto,
  ) {
    return this.service.saveAnswers(id, req.user.id, dto);
  }

  @Post('instances/:id/reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('patient')
  resetAnswers(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.resetAnswers(id, req.user.id);
  }

  @Delete('instances/:id')
  @UseGuards(JwtAuthGuard)
  deleteInstance(
    @Request() req: { user: { id: string; role: string } },
    @Param('id') id: string,
  ) {
    return this.service.deleteInstance(id, req.user.id, req.user.role);
  }

  @Post('reminders/check')
  @Public()
  checkReminders() {
    return this.service.sendDueReminders();
  }
}
