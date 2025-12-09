import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private logger: LoggerService,
  ) {}

  async validateOrCreateUser(profile: any) {
    const select = {
      id: true,
      name: true,
      email: true,
      picture: true,
      wallet: {
        select: {
          id: true,
          userId: true,
          balance: true,
          walletNumber: true
        }
      }
    }
    try {
      let user: any = await this.prisma.user.findUnique({
        where: { googleId: profile.id },
        select
      });

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: profile.emails[0]?.value || profile.displayName,
            googleId: profile.id,
            name: profile.displayName,
            picture: profile.photos[0]?.value,
            wallet: {
              create: {},
            },
          },
          select
        });
        this.logger.log(`New user created: ${user.id}`);
      } else {
        const wallet = await this.prisma.wallet.findUnique({
          where: { userId: user.id },
        });
        if (!wallet) {
          await this.prisma.wallet.create({
            data: { userId: user.id },
          });
          this.logger.log(`Wallet created for user: ${user.id}`);
        }
      }

      return user;
    } catch (error) {
      this.logger.error('Error validating or creating user', error);
      throw error;
    }
  }

  generateJwt(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };
    return this.jwtService.sign(payload);
  }

  async validateJwt(payload: any) {
    return this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { wallet: true },
    });
  }
}
