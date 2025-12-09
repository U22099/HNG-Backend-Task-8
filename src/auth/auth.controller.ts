import { Controller, Get, Res, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth sign-in' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects with JWT token',
    schema: {
      example: {
        user: {
          id: 'user...id...',
          name: 'Daniel',
          email: 'u22099dandev@gmail.com',
          picture: 'https://lh3.googleusercontent.com...',
          wallet: {
            id: 'wallet...id...',
            userId: 'user...id...',
            balance: 0,
            walletNumber: 'wallet...number...',
          },
        },
        jwtToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbWl5b2U2NGswMD...',
      },
    },
  })
  googleAuthCallback(@Req() req: any) {
    return { ...req?.user };
  }
}
