import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';

@Module({
  imports: [AuthModule],
  controllers: [TtsController],
  providers: [TtsService],
})
export class TtsModule {}
