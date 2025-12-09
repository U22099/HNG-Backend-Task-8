import { Module } from '@nestjs/common';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyController } from './controllers/api-key.controller';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from './logger/logger.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, PrismaService, LoggerService],
  exports: [ApiKeyService, LoggerService, PrismaService],
})
export class CommonModule {}
