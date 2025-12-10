import { Controller, Get, Res, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({
    summary: 'Initiate Google OAuth sign-in',
    description: `🚨 **IMPORTANT:** Use this link to test the full redirect flow:\n\n[Launch Google Sign-In in a New Tab](${process.env.BASE_URL}/auth/google) (Opens in new tab)`,
  })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({
    status: 200,
    description: 'Validates and returns JwtToken',
    schema: {
      example: {
        user: {
          id: 'user...id...',
          name: 'Daniel',
          email: 'ur_email@gmail.com',
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
