import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntakeTest } from '../entities/intake-test.entity';
import { Doctor } from '../entities/doctor.entity';
import { IntakeTestsService } from './intake-tests.service';
import { IntakeTestsController } from './intake-tests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IntakeTest, Doctor])],
  providers: [IntakeTestsService],
  controllers: [IntakeTestsController],
  exports: [IntakeTestsService],
})
export class IntakeTestsModule {}
