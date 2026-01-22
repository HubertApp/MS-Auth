import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'DEFAULT_SECRET',
    });
  }

  // validate(payload) {
  // const user = this.authService.findById(payload.sub);

  // if (!user) {
  //   throw new UnauthorizedException(
  //     'Jeton invalide ou utilisateur non trouvé.',
  //   );
  // }

  // return payload;
  // }
  validate(): void {
    console.log('JWT validated');
  }
}
