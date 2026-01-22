import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import express from 'express';
import { CreateAuthInput } from './dto/create-auth.input';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: express.Request) {
    const user_google: CreateAuthInput = req.user as CreateAuthInput;
    console.log(
      `${user_google?.googleId}&email=${user_google?.email}&pseudo=${user_google?.pseudo}`,
    );

    const user: CreateAuthInput = await this.authService.findOrCreateUser({
      googleId: user_google.googleId,
      email: user_google.email,
      pseudo: user_google.pseudo,
      age: 0,
      role: 'USER',
    });

    const accessToken = this.authService.getJwtToken(user);

    return {
      accessToken: accessToken,
    };
  }
}
