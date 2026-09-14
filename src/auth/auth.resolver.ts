import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';
import { AuthService } from './auth.service';
import { Auth } from './entities/auth.entity';
import { UnauthorizedException } from './exception/unauthorized.exception';

@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(private authService: AuthService) {}

  @Mutation(() => Auth)
  async loginWithGoogle(@Args('idToken') idToken: string): Promise<Auth> {
    let payload: TokenPayload | undefined;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (error) {

      this.logger.warn(
        `Vérification du token Google échouée (${error instanceof Error ? error.name : 'erreur inconnue'})`,
      );
      throw new UnauthorizedException('ID token invalide');
    }

    if (!payload) {
      this.logger.warn('Token Google vérifié mais sans payload exploitable');
      throw new UnauthorizedException('ID token invalide');
    }

    const user = await this.authService.findOrCreateUser({
      googleId: payload.sub,
      email: payload.email!,
      pseudo: payload.given_name || payload.name!,
      photo: payload.picture,
      age: 0,
      role: 'USER',
    });

    this.logger.info(`Utilisateur connecté avec Google : ${user.email}`);

    return { accessToken: this.authService.getJwtToken(user) };
  }

  @Mutation(() => Auth)
  async loginAdmin(
    @Args('email') email: string,
    @Args('password') password: string,
  ): Promise<Auth> {

    const userAdmin = await this.authService.findUserAdmin({ email, password });

    return { accessToken: this.authService.getJwtToken(userAdmin) };
  }

  // @Mutation(() => User)
  // async refreshToken(
  //     @Args('refreshToken') refreshToken: string,
  // ): Promise<string> {
  //     return this.authService.refreshToken(refreshToken);
  // }
}
