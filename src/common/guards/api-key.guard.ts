import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    

    if (request.user && request.user.id) {
      return true;
    }

    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(
        'Missing authentication: Bearer JWT or x-api-key header required',
      );
    }

    try {
      const key = await this.prisma.apiKey.findUnique({
        where: { key: apiKey as string },
        include: { user: true },
      });

      if (!key) {
        throw new ForbiddenException('Invalid API key');
      }

      if (key.revokedAt) {
        throw new ForbiddenException('API key has been revoked');
      }

      if (new Date() > key.expiresAt) {
        throw new ForbiddenException('API key has expired');
      }

      request.user = key.user;
      request.apiKeyPermissions = key.permissions;
      request.apiKeyId = key.id;

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException(
        `Invalid or expired API key: ${error.message}`,
      );
    }
  }
}
