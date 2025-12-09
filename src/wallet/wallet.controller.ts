import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Param,
  Headers,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiKeyPermissions } from '../common/decorators/api-key-permissions.decorator';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
  ApiSecurity,
} from '@nestjs/swagger';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  validateApiKeyPermission(permissions: string[], requiredPermission: string){
    return permissions.includes(requiredPermission);
  }

  @Get('balance')
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-api-key')
  @UseGuards(JwtAuthGuard, ApiKeyGuard)
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({
    status: 200,
    description: 'Wallet balance retrieved successfully',
    schema: {
      example: {
        balance: 15000,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT/API Key',
  })
  async getBalance(@CurrentUser() user: any, @ApiKeyPermissions() permissions: string[]) {
    const permitted = this.validateApiKeyPermission(permissions, 'read');
    if(!permitted) throw new UnauthorizedException('This api key does not have the necessary permissions to  perform this action');
    return this.walletService.getWalletBalance(user.id);
  }

  @Post('deposit')
  @UseGuards(JwtAuthGuard, ApiKeyGuard)
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-api-key')
  @ApiHeader({
    name: 'x-api-key',
    description: 'API Key with deposit permission',
    required: false,
  })
  @ApiOperation({
    summary: 'Initialize a deposit with Paystack',
    description:
      'Creates a Paystack transaction and returns a payment link. User must complete payment on Paystack.',
  })
  @ApiBody({
    type: CreateDepositDto,
    examples: {
      example1: {
        summary: 'Deposit 5000 Naira',
        value: {
          amount: 5000,
        },
      },
      example2: {
        summary: 'Deposit 50000 Naira',
        value: {
          amount: 50000,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Deposit initialized successfully',
    schema: {
      example: {
        reference: 'wallet_user123_1704099600000_a1b2c3d4',
        authorization_url: 'https://checkout.paystack.com/...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async initializeDeposit(
    @CurrentUser() user: any,
    @ApiKeyPermissions() permissions: string[],
    @Body() depositDto: CreateDepositDto,
  ) {
    const permitted = this.validateApiKeyPermission(permissions, 'deposit');
    if(!permitted) throw new UnauthorizedException('This api key does not have the necessary permissions to  perform this action');
    return this.walletService.initializeDeposit(user.id, depositDto);
  }

  @Get('deposit/:reference/status')
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-api-key')
  @UseGuards(JwtAuthGuard, ApiKeyGuard)
  @ApiOperation({
    summary: 'Verify deposit status (manual check only)',
    description:
      'Checks the status of a deposit.',
  })
  @ApiResponse({
    status: 200,
    description: 'Deposit status retrieved',
    schema: {
      example: {
        reference: 'wallet_user123_1704099600000_a1b2c3d4',
        status: 'success',
        amount: 5000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async verifyDepositStatus(@ApiKeyPermissions() permissions: string[], @Param('reference') reference: string) {
    const permitted = this.validateApiKeyPermission(permissions, 'read');
    if(!permitted) throw new UnauthorizedException('This api key does not have the necessary permissions to  perform this action');
    return this.walletService.verifyDepositStatus(reference);
  }

  @Post('paystack/webhook')
  @ApiOperation({
    summary: 'Paystack webhook endpoint (MANDATORY)',
    description:
      'Receives transaction updates from Paystack. Only this endpoint can credit wallets. Must validate Paystack signature.',
  })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'Paystack HMAC signature for verification',
    required: true,
  })
  @ApiBody({
    schema: {
      example: {
        event: 'charge.success',
        data: {
          id: 123456,
          reference: 'wallet_user123_1704099600000_a1b2c3d4',
          amount: 500000,
          paid_at: '2025-01-01T12:00:00.000Z',
          customer: {
            id: 1,
            email: 'user@example.com',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    schema: {
      example: {
        status: true,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook signature',
  })
  async handlePaystackWebhook(
    @Req() request: Request,
    @Headers('x-paystack-signature') signature: string,
  ) {
    const body =
      typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    return this.walletService.handlePaystackWebhook(body, signature);
  }

  @Post('transfer')
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-api-key')
  @UseGuards(JwtAuthGuard, ApiKeyGuard)
  @ApiOperation({
    summary: 'Transfer funds to another wallet',
    description:
      'Transfer money from your wallet to another user\'s wallet. Checks balance and recipient validity.',
  })
  @ApiBody({
    type: TransferDto,
    examples: {
      example1: {
        summary: 'Transfer 1000 to another user',
        value: {
          wallet_number: '4566678954356',
          amount: 1000,
        },
      },
      example2: {
        summary: 'Transfer 5000 with description',
        value: {
          wallet_number: '4566678954356',
          amount: 5000,
          description: 'Payment for services',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer completed successfully',
    schema: {
      example: {
        status: 'success',
        message: 'Transfer completed',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid request - insufficient balance, invalid wallet, or same wallet',
  })
  @ApiResponse({
    status: 404,
    description: 'Recipient wallet not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async transfer(
    @CurrentUser() user: any,
    @ApiKeyPermissions() permissions: string[],
    @Body() transferDto: TransferDto,
  ) {
    const permitted = this.validateApiKeyPermission(permissions, 'transfer');
    if(!permitted) throw new UnauthorizedException('This api key does not have the necessary permissions to  perform this action');
    return this.walletService.transferFunds(user.id, transferDto);
  }

  @Get('transactions')
  @ApiBearerAuth('access-token')
  @ApiSecurity('x-api-key')
  @UseGuards(JwtAuthGuard, ApiKeyGuard)
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Retrieve all transactions for the authenticated user\'s wallet (deposits, transfers sent/received)',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
    schema: {
      example: [
        {
          id: 'txn_123abc',
          type: 'deposit',
          amount: 5000,
          status: 'success',
          description: 'Paystack deposit',
          reference: 'wallet_user123_1704099600000_a1b2c3d4',
          createdAt: '2025-01-01T12:00:00Z',
        },
        {
          id: 'txn_456def',
          type: 'transfer',
          amount: 2000,
          status: 'success',
          description: 'Sent to wallet 4566678954356',
          reference: 'transfer_user123_1704185600000_e5f6g7h8',
          createdAt: '2025-01-02T14:30:00Z',
        },
        {
          id: 'txn_789ghi',
          type: 'transfer',
          amount: 1500,
          status: 'success',
          description: 'Received from wallet 1234567890123',
          reference: 'transfer_otheruser_1704272000000_i9j0k1l2',
          createdAt: '2025-01-03T10:15:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  async getTransactions(@CurrentUser() user: any, @ApiKeyPermissions() permissions: string[]) {
    const permitted = this.validateApiKeyPermission(permissions, 'read');
    if(!permitted) throw new UnauthorizedException('This api key does not have the necessary permissions to  perform this action');
    return this.walletService.getTransactionHistory(user.id);
  }
}
