// import {
//   Controller,
//   Get,
//   UseGuards,
//   Req,
//   Post,
//   Body,
//   Res,
//   Injectable,
//   ExecutionContext,
// } from '@nestjs/common';
// import express from 'express';
// import { AuthGuard } from '@nestjs/passport';
// import { AuthService } from './auth.service';
// import { JwtService } from '@nestjs/jwt';
// import { CreateAuthInput } from './dto/create-auth.input';

// @Injectable()
// export class GoogleAuthGuard extends AuthGuard('google') {
//   getAuthenticateOptions(context: ExecutionContext) {
//     const req = context.switchToHttp().getRequest();
//     const platform = req.query.platform === 'android' ? 'android' : 'web';
//     return { state: platform };
//   }
// }

// @Controller('auth')
// export class AuthController {
//   constructor(
//     private authService: AuthService,
//     private jwtService: JwtService,
//   ) {}

//   @Get('google')
//   @UseGuards(GoogleAuthGuard)
//   async googleAuth() {}

//   @Get('google/callback')
//   @UseGuards(AuthGuard('google'))
//   async googleAuthRedirect(@Req() req: any, @Res() res: express.Response) {
//     const user_google: CreateAuthInput = req.user as CreateAuthInput;

//     const user: CreateAuthInput = await this.authService.findOrCreateUser({
//       googleId: user_google.googleId,
//       email: user_google.email,
//       pseudo: user_google.pseudo,
//       age: 0,
//       role: 'USER',
//     });

//     const accessToken = this.authService.getJwtToken(user);
//     const platform = req.query.state;

//     if (platform === 'android') {
//       return res.redirect(`hubertapp://auth-callback?token=${accessToken}`);
//     }

//     res
//       .cookie('jwt', accessToken, {
//         httpOnly: true,
//         secure: false,
//         sameSite: 'lax',
//         maxAge: 3600000,
//       })
//       .send(`<script>window.close();</script>`);
//   }

//   @Get('jwks')
//   getJwks() {
//     return this.authService.getJwks();
//   }

//   @Post('verify')
//   async verifyToken(@Body() body: any) {
//     const authHeader = body.headers?.authorization;

//     if (!authHeader) {
//       return {
//         ...body,
//         headers: { ...body.headers, 'x-auth-state': 'ANONYMOUS' },
//       };
//     }

//     const token = authHeader.split(' ')[1];

//     try {
//       const decoded = await this.jwtService.verify(token);
//       return {
//         ...body,
//         headers: {
//           ...body.headers,
//           'x-auth-state': 'VALID',
//           'x-user-id': String(decoded.sub),
//           'x-user-role': String(decoded.role),
//           'x-user-email': String(decoded.email),
//           'x-user-pseudo': String(decoded.pseudo),
//           'x-user-age': String(decoded.age),
//         },
//       };
//     } catch {
//       return {
//         ...body,
//         headers: { ...body.headers, 'x-auth-state': 'INVALID_TOKEN' },
//       };
//     }
//   }
// }
