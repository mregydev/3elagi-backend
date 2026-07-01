import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SttController } from './stt.controller';
import { SttService } from './stt.service';

@Module({
  imports: [AuthModule],
  controllers: [SttController],
  providers: [SttService],
})
export class SttModule {}
