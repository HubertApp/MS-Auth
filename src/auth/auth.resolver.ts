import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Resolver() 
export class AuthResolver {
  constructor(private jwtService: JwtService, private authService: AuthService) {}
  @Query('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Context() context: any) {
    const userPayload = context.req.user;
    
    return {
      id: userPayload.userId,
      email: userPayload.email,
      pseudo: userPayload.pseudo,
    };
  }

  @Mutation('googleLogin')
  async googleLogin(
    @Args('googleId') googleId: string,
    @Args('email') email: string,
    @Args('pseudo') pseudo: string,
  ) {
 
    const user = await this.authService.findOrCreateUser({
      googleId,
      email,
      pseudo,
    });

    const accessToken = await this.authService.getJwtToken(user);
    
    return {
      user: user,
      accessToken: accessToken,
    };
  }


}