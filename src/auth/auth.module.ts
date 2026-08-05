import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
// import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
// import { GoogleStrategy } from './strategy/google.strategy';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategy/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: configService
          .get<string>('JWT_PRIVATE_KEY')!
          .replace(/\\n/g, '\n'),
        publicKey: configService
          .get<string>('JWT_PUBLIC_KEY')!
          .replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get('JWT_EXPIRATION_TIME') || '60m',
          keyid: 'auth-key-1',
        },
      }),
    }),
  ],
  providers: [AuthResolver, JwtStrategy, AuthService],
})
export class AuthModule {}
