import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    const authOnlyEndpoint = request.url.startsWith('/keys');

    if (!authHeader && request.headers['x-api-key'] && !authOnlyEndpoint) {
      return true;
    } else if (!authHeader && authOnlyEndpoint)
      throw new UnauthorizedException(
        'Missing authentication: Bearer JWT required',
      );
    else if (!authHeader)
      throw new UnauthorizedException(
        'Missing authentication: Bearer JWT or x-api-key header required',
      );

    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      throw new UnauthorizedException('No JWT token provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.user = { id: payload.sub, ...payload };
      request.apiKeyPermissions = ['deposit', 'transfer', 'read'];
      return true;
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid or expired JWT token: ${error.message}`,
      );
    }
  }
}
