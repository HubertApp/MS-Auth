import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { UnauthorizedException } from '../exception/unauthorized.exception';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtPayload } from 'jsonwebtoken';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'DEFAULT_SECRET',
    });
  }

  async validate(payload: { sub: number; email: string }) {
    const user = await this.authService.findById(payload.sub); // Utilisation de la nouvelle méthode

    if (!user) {
      throw new UnauthorizedException('Jeton invalide ou utilisateur non trouvé.');
    }
    
    // Vous pouvez retourner l'objet complet ou un sous-ensemble si vous préférez
    return user; 
  }
}