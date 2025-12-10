import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';
import { PaystackService } from '../paystack/paystack.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import * as crypto from 'crypto';

@Injectable()
export class WalletService {
  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
    private paystackService: PaystackService,
  ) {}

  async getWalletBalance(userId: string) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      this.logger.log(
        `Retrieved wallet balance for user ${userId}: ${wallet.balance}`,
      );
      return { balance: wallet.balance, wallet_number: wallet.walletNumber };
    } catch (error) {
      this.logger.error('Error getting wallet balance', error);
      throw error;
    }
  }

  async initializeDeposit(userId: string, depositDto: CreateDepositDto) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const reference = `wallet_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const paystackResponse = await this.paystackService.initializeTransaction(
        {
          email: wallet.user.email,
          amount: Math.round(depositDto.amount * 100),
          reference,
          metadata: {
            userId,
            walletId: wallet.id,
          },
        },
      );

      await this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'deposit',
          amount: depositDto.amount,
          reference,
          paystackRef: paystackResponse.reference,
          status: 'pending',
          metadata: {
            paystackAuthorizationUrl: paystackResponse.authorization_url,
          },
        },
      });

      this.logger.log(
        `Deposit initiated for user ${userId}: ${depositDto.amount}, reference: ${reference}`,
      );

      return {
        reference,
        authorization_url: paystackResponse.authorization_url,
      };
    } catch (error) {
      this.logger.error('Error initializing deposit', error);
      throw error;
    }
  }

  async verifyDepositStatus(reference: string) {
    try {
      const transaction = await this.prisma.transaction.findUnique({
        where: { reference },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.paystackRef && transaction.status === 'pending') {
        await this.paystackService.verifyTransaction(transaction.paystackRef);
      }

      this.logger.log(
        `Verified deposit status for reference ${reference}: ${transaction.status}`,
      );

      return {
        reference: transaction.reference,
        status: transaction.status,
        amount: transaction.amount,
      };
    } catch (error) {
      this.logger.error('Error verifying deposit status', error);
      throw error;
    }
  }

  async handlePaystackWebhook(event: any, signature: string) {
    try {
      const verified = this.paystackService.verifyWebhookSignature(
        event,
        signature,
      );
      if (!verified) {
        throw new BadRequestException('Invalid webhook signature');
      }

      if (event.event === 'charge.success') {
        const reference = event.data.reference;
        const transaction = await this.prisma.transaction.findUnique({
          where: { paystackRef: reference },
          include: { wallet: true },
        });

        if (!transaction) {
          this.logger.warn(
            `Transaction not found for paystack reference: ${reference}`,
          );
          return { status: true };
        }

        if (transaction.status === 'success') {
          this.logger.log(`Transaction already processed: ${reference}`);
          return { status: true };
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: { status: 'success' },
          });

          await tx.wallet.update({
            where: { id: transaction.wallet.id },
            data: {
              balance: transaction.wallet.balance + transaction.amount,
            },
          });
        });

        this.logger.log(
          `Deposit successful for transaction ${reference}, amount: ${transaction.amount}`,
        );
      }

      return { status: true };
    } catch (error) {
      this.logger.error('Error handling Paystack webhook', error);
      throw error;
    }
  }

  async transferFunds(senderId: string, transferDto: TransferDto) {
    try {
      const senderWallet = await this.prisma.wallet.findUnique({
        where: { userId: senderId },
        include: { user: { select: { name: true } } },
      });

      if (!senderWallet) {
        throw new NotFoundException('Sender wallet not found');
      }

      const recipientWallet = await this.prisma.wallet.findUnique({
        where: { walletNumber: transferDto.wallet_number },
        include: { user: { select: { name: true } } },
      });

      if (!recipientWallet) {
        throw new NotFoundException('Recipient wallet not found');
      }

      if (senderWallet.userId === recipientWallet.userId) {
        throw new BadRequestException('Cannot transfer to your own wallet');
      }

      if (senderWallet.balance < transferDto.amount) {
        throw new BadRequestException('Insufficient balance');
      }

      const transferReference = `transfer_${senderWallet.userId}_${recipientWallet.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const recipientReference = `transfer_${senderWallet.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const senderReference = `transfer_${recipientWallet.userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: senderWallet.id },
          data: {
            balance: senderWallet.balance - transferDto.amount,
          },
        });

        await tx.wallet.update({
          where: { id: recipientWallet.id },
          data: {
            balance: recipientWallet.balance + transferDto.amount,
          },
        });

        await tx.transfer.create({
          data: {
            senderId,
            recipientId: recipientWallet.userId,
            amount: transferDto.amount,
            reference: transferReference,
            status: 'success',
            description: transferDto.description,
          },
        });

        await tx.transaction.create({
          data: {
            walletId: senderWallet.id,
            type: 'transfer',
            amount: transferDto.amount,
            status: 'success',
            reference: senderReference,
            description: `Transfer to ${recipientWallet.user.name}`,
          },
        });

        await tx.transaction.create({
          data: {
            walletId: recipientWallet.id,
            type: 'transfer',
            amount: transferDto.amount,
            status: 'success',
            reference: recipientReference,
            description: `Received from ${senderWallet.user.name}`,
          },
        });
      });

      this.logger.log(
        `Transfer successful: ${senderId} -> ${recipientWallet.userId}, amount: ${transferDto.amount}`,
      );

      return {
        status: 'success',
        message: 'Transfer completed',
      };
    } catch (error) {
      this.logger.error('Error transferring funds', error);
      throw error;
    }
  }

  async getTransactionHistory(userId: string, limit: number = 50) {
    try {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const transactions = await this.prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      this.logger.log(
        `Retrieved ${transactions.length} transactions for user ${userId}`,
      );

      return transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        description: t.description,
        reference: t.reference,
        createdAt: t.createdAt,
      }));
    } catch (error) {
      this.logger.error('Error getting transaction history', error);
      throw error;
    }
  }
}
