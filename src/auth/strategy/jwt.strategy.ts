import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '../exception/unauthorized.exception';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
// import { JwtPayload } from 'jsonwebtoken';

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

  validate(payload: { sub: string; email: string }) {
    const user = this.authService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(
        'Jeton invalide ou utilisateur non trouvé.',
      );
    }

    return user;
  }
}
