import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { Auth } from './entities/auth.entity';

@Resolver()
export class AuthResolver {
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(private authService: AuthService) {}

  @Mutation(() => Auth)
  async loginWithGoogle(@Args('idToken') idToken: string) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new Error('ID token invalide');

    const user = await this.authService.findOrCreateUser({
      googleId: payload.sub,
      email: payload.email!,
      pseudo: payload.given_name || payload.name!,
      age: 0,
      role: 'USER',
    });

    return { accessToken: this.authService.getJwtToken(user) };
  }

  @Mutation(() => Auth)
  async loginAdmin(@Args('email') email: string, @Args('password') password: string) {

    const userAdmin = await this.authService.findUserAdmin({
      email: email,
      password: password,
    });

    return { accessToken: this.authService.getJwtToken(userAdmin) };
  }

  // @Mutation(() => User)
  // async refreshToken(
  //     @Args('refreshToken') refreshToken: string,
  // ): Promise<string> {
  //     return this.authService.refreshToken(refreshToken);
  // }
}
