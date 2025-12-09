import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class PaystackService {
  private axiosInstance: AxiosInstance;
  private secretKey: string;

  constructor(private logger: LoggerService) {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    if (!this.secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not defined in environment');
    }

    this.axiosInstance = axios.create({
      baseURL: process.env.PAYSTACK_API_URL || 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initializeTransaction(data: {
    email: string;
    amount: number;
    reference: string;
    metadata?: any;
  }) {
    try {
      const response = await this.axiosInstance.post(
        '/transaction/initialize',
        {
          email: data.email,
          amount: data.amount,
          reference: data.reference,
          metadata: data.metadata,
        },
      );

      if (!response.data.status) {
        throw new BadRequestException(response.data.message);
      }

      this.logger.log(`Paystack transaction initialized: ${data.reference}`);

      return {
        reference: response.data.data.reference,
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
      };
    } catch (error) {
      this.logger.error('Error initializing Paystack transaction', error);
      throw new InternalServerErrorException(
        'Failed to initialize payment. Please try again.',
      );
    }
  }

  async verifyTransaction(reference: string) {
    try {
      const response = await this.axiosInstance.get(
        `/transaction/verify/${reference}`,
      );

      if (!response.data.status) {
        throw new BadRequestException(response.data.message);
      }

      this.logger.log(`Paystack transaction verified: ${reference}`);

      return {
        status: response.data.data.status,
        reference: response.data.data.reference,
        amount: response.data.data.amount,
        currency: response.data.data.currency,
        customer: response.data.data.customer,
      };
    } catch (error) {
      this.logger.error('Error verifying Paystack transaction', error);
      throw new InternalServerErrorException(
        'Failed to verify payment. Please try again.',
      );
    }
  }

  verifyWebhookSignature(body: any, signature: string): boolean {
    try {
      const hash = crypto
        .createHmac('sha512', this.secretKey)
        .update(JSON.stringify(body))
        .digest('hex');

      const verified = hash === signature;

      if (!verified) {
        this.logger.warn('Invalid Paystack webhook signature');
      } else {
        this.logger.log('Paystack webhook signature verified');
      }

      return verified;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }
}
