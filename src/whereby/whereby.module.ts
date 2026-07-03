import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../entities/user.entity';
import { WherebyController } from './whereby.controller';
import { WherebyService } from './whereby.service';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User])],
  controllers: [WherebyController],
  providers: [WherebyService],
})
export class WherebyModule {}
