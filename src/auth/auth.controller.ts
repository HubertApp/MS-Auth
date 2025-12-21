import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import express from 'express';
import { CreateAuthInput } from './dto/create-auth.input';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(
    @Req() req: express.Request,
    // @Res() res: express.Response,
  ) {
    const user: CreateAuthInput = req.user as CreateAuthInput;
    // const redirectUrl = ;
    console.log(
      `${user?.googleId}&email=${user?.email}&pseudo=${user?.pseudo}`,
    );
    // res.redirect(redirectUrl);
  }
}
