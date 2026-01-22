import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
import { GoogleStrategy } from './strategy/google.strategy';
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
        secret: configService.get('JWT_SECRET') || 'DEFAULT_SECRET',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION_TIME') || '60m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthResolver, GoogleStrategy, JwtStrategy, AuthService],
})
export class AuthModule {}
