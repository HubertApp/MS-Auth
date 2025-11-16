import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import express from 'express';

@Controller('auth')
export class AuthController {
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: express.Request, @Res() res: express.Response) {

    const user: any = req.user; 
    // const redirectUrl = ;
    console.log(`${user.googleId}&email=${user.email}&pseudo=${user.pseudo}`);
    // res.redirect(redirectUrl);
  }
}