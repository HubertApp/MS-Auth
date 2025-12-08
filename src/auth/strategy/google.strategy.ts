import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; 

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
      constructor(config: ConfigService) {
            super({
            clientID: config.get<string>('GOOGLE_CLIENT_ID'),
            clientSecret: config.get<string>('GOOGLE_SECRET'),
            callbackURL: config.get<string>('GOOGLE_CALLBACK_URL'),
          scope: ['email', 'profile'],
          passReqToCallback: false,
          
      } as StrategyOptions);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const user = {
        email: emails[0].value,
        pseudo: name.givenName,
        googleId: id,
    };
    done(null, user);
  }
}