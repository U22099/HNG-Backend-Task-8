import { Module } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { LoggerService } from '../common/logger/logger.service';

@Module({
  providers: [PaystackService, LoggerService],
  exports: [PaystackService],
})
export class PaystackModule {}
