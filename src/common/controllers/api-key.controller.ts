import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiKeyService } from '../services/api-key.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { RolloverApiKeyDto } from '../dto/rollover-api-key.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('API Keys')
@ApiBearerAuth('access-token')
@Controller('keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private apiKeyService: ApiKeyService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Create a new API key',
    description:
      'Generate a new API key for service-to-service authentication. Maximum 5 active keys per user. Keys can have permissions: deposit, transfer, read.',
  })
  @ApiBody({
    type: CreateApiKeyDto,
    examples: {
      example1: {
        summary: 'Create key with all permissions (1 day expiry)',
        value: {
          name: 'wallet-service',
          permissions: ['deposit', 'transfer', 'read'],
          expiry: '1D',
        },
      },
      example2: {
        summary: 'Create read-only key (1 month expiry)',
        value: {
          name: 'reporting-service',
          permissions: ['read'],
          expiry: '1M',
        },
      },
      example3: {
        summary: 'Create deposit-transfer key (1 hour expiry)',
        value: {
          name: 'temporary-payment-service',
          permissions: ['deposit', 'transfer'],
          expiry: '1H',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    schema: {
      example: {
        api_key: 'sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
        expires_at: '2025-01-01T12:00:00Z',
        name: 'wallet-service',
        permissions: ['deposit', 'transfer', 'read'],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Max 5 active keys, invalid expiry or permissions',
  })
  async createApiKey(
    @CurrentUser() user: any,
    @Body() createApiKeyDto: CreateApiKeyDto,
  ) {
    return this.apiKeyService.createApiKey(user.id, createApiKeyDto);
  }

  @Get('list')
  @ApiOperation({
    summary: 'List all API keys for the user',
    description: 'Retrieve all API keys created by the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys',
    schema: {
      example: [
        {
          id: 'key_123abc',
          name: 'wallet-service',
          key: 'sk_live_anboena....',
          permissions: ['deposit', 'transfer', 'read'],
          expires_at: '2025-01-01T12:00:00Z',
          revoked_at: null,
          is_active: true,
          created_at: '2024-12-01T10:00:00Z',
        },
        {
          id: 'key_456def',
          name: 'reporting-service',
          key: 'sk_live_zibaib....',
          permissions: ['read'],
          expires_at: '2025-02-15T08:30:00Z',
          revoked_at: null,
          is_active: true,
          created_at: '2024-11-15T14:22:00Z',
        },
        {
          id: 'key_789ghi',
          name: 'old-service',
          key: 'sk_live_inebo....',
          permissions: ['deposit', 'transfer'],
          expires_at: '2024-12-20T12:00:00Z',
          revoked_at: '2024-12-25T09:15:00Z',
          is_active: false,
          created_at: '2024-10-20T11:45:00Z',
        },
      ],
    },
  })
  async listApiKeys(@CurrentUser() user: any) {
    return this.apiKeyService.listApiKeys(user.id);
  }

  @Delete(':keyId/revoke')
  @ApiOperation({
    summary: 'Revoke an API key',
    description:
      'Permanently revoke an API key. Once revoked, it cannot be used. This action is irreversible.',
  })
  @ApiResponse({
    status: 200,
    description: 'API key revoked successfully',
    schema: {
      example: {
        message: 'API key revoked successfully',
        id: 'key_123abc',
        revoked_at: '2025-01-02T14:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'API key not found',
  })
  async revokeApiKey(
    @CurrentUser() user: any,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeyService.revokeApiKey(user.id, keyId);
  }

  @Post('rollover')
  @ApiOperation({
    summary: 'Rollover an expired API key with new expiry',
    description:
      'Create a new API key using the same permissions as an expired key. Only expired keys can be rolled over. New key gets new expiration time.',
  })
  @ApiBody({
    type: RolloverApiKeyDto,
    examples: {
      example1: {
        summary: 'Rollover with 1 month extension',
        value: {
          expired_key_id: 'key_123abc',
          expiry: '1M',
        },
      },
      example2: {
        summary: 'Rollover with 1 year extension',
        value: {
          expired_key_id: 'key_456def',
          expiry: '1Y',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'API key rolled over successfully',
    schema: {
      example: {
        api_key: 'sk_live_new1key2here3with4newexpiry5',
        expires_at: '2025-02-02T12:00:00Z',
        name: 'wallet-service (rolled over)',
        permissions: ['deposit', 'transfer', 'read'],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - Key is still active or not found',
  })
  async rolloverApiKey(
    @CurrentUser() user: any,
    @Body() rolloverDto: RolloverApiKeyDto,
  ) {
    return this.apiKeyService.rolloverApiKey(user.id, rolloverDto);
  }
}
