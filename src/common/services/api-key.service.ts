import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LoggerService } from '../logger/logger.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { RolloverApiKeyDto } from '../dto/rollover-api-key.dto';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  private readonly MAX_ACTIVE_KEYS = 5;

  constructor(
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  private calculateExpireTime(expiry: string): Date {
    const now = new Date();

    switch (expiry) {
      case '1H':
        return new Date(now.getTime() + 60 * 60 * 1000);
      case '1D':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case '1M':
        return new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          now.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        );
      case '1Y':
        return new Date(
          now.getFullYear() + 1,
          now.getMonth(),
          now.getDate(),
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
        );
      default:
        throw new BadRequestException('Invalid expiry unit');
    }
  }

  private generateApiKey(): string {
    const random = crypto.randomBytes(32).toString('hex');
    return `sk_live_${random}`;
  }

  async createApiKey(userId: string, createApiKeyDto: CreateApiKeyDto) {
    try {
      const activeKeys = await this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (activeKeys >= this.MAX_ACTIVE_KEYS) {
        throw new BadRequestException(
          `Maximum of ${this.MAX_ACTIVE_KEYS} active API keys allowed`,
        );
      }

      const apiKey = this.generateApiKey();
      const expiresAt = this.calculateExpireTime(createApiKeyDto.expiry);

      const createdKey = await this.prisma.apiKey.create({
        data: {
          userId,
          name: createApiKeyDto.name,
          key: apiKey,
          permissions: createApiKeyDto.permissions,
          expiresAt,
        },
      });

      this.logger.log(`API key created for user ${userId}: ${createdKey.id}`);

      return {
        api_key: apiKey,
        expires_at: expiresAt.toISOString(),
        name: createdKey.name,
        permissions: createdKey.permissions,
      };
    } catch (error) {
      this.logger.error('Error creating API key', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create API key');
    }
  }

  async listApiKeys(userId: string) {
    try {
      const keys = await this.prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          key: true,
          permissions: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return keys.map((key) => ({
        id: key.id,
        name: key.name,
        key: key.key,
        permissions: key.permissions,
        expires_at: key.expiresAt.toISOString(),
        revoked_at: key.revokedAt?.toISOString() || null,
        is_active: !key.revokedAt && new Date() < key.expiresAt,
        created_at: key.createdAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error('Error listing API keys', error);
      throw new BadRequestException('Failed to list API keys');
    }
  }

  async revokeApiKey(userId: string, keyId: string) {
    try {
      const key = await this.prisma.apiKey.findUnique({
        where: { id: keyId },
      });

      if (!key) {
        throw new NotFoundException('API key not found');
      }

      if (key.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to revoke this key',
        );
      }

      const revoked = await this.prisma.apiKey.update({
        where: { id: keyId },
        data: { revokedAt: new Date() },
      });

      this.logger.log(`API key revoked: ${keyId}`);

      return {
        message: 'API key revoked successfully',
        id: revoked.id,
        revoked_at: revoked.revokedAt?.toISOString(),
      };
    } catch (error) {
      this.logger.error('Error revoking API key', error);
      throw error;
    }
  }

  async rolloverApiKey(userId: string, rolloverDto: RolloverApiKeyDto) {
    try {
      const oldKey = await this.prisma.apiKey.findUnique({
        where: { id: rolloverDto.expired_key_id },
      });

      if (!oldKey) {
        throw new NotFoundException('API key not found');
      }

      if (oldKey.userId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to rollover this key',
        );
      }

      if (new Date() <= oldKey.expiresAt && !oldKey.revokedAt) {
        throw new BadRequestException(
          'API key is still active. Only expired keys can be rolled over',
        );
      } else if (oldKey.revokedAt) {
        throw new BadRequestException(
          'API key has been revoked. Only expired keys can be rolled over',
        );
      }

      const newApiKey = this.generateApiKey();
      const newExpiresAt = this.calculateExpireTime(rolloverDto.expiry);

      const newKey = await this.prisma.apiKey.create({
        data: {
          userId,
          name: `${oldKey.name} (rolled over)`,
          key: newApiKey,
          permissions: oldKey.permissions || {},
          expiresAt: newExpiresAt,
          rolledOverFrom: oldKey.id,
        },
      });

      await this.prisma.apiKey.update({
        where: { id: oldKey.id },
        data: { rolledOverAt: new Date() },
      });

      this.logger.log(`API key rolled over from ${oldKey.id} to ${newKey.id}`);

      return {
        api_key: newApiKey,
        expires_at: newExpiresAt.toISOString(),
        name: newKey.name,
        permissions: newKey.permissions,
      };
    } catch (error) {
      this.logger.error('Error rolling over API key', error);
      throw error;
    }
  }
}
