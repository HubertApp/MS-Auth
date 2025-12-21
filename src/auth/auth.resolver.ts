import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Query('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Context('req') req: Request & { user?: User }) {
    const id: string = req.user?.id as string;
    console.log('GetMe ID:', req.user);
    const user: User | undefined = this.authService.findById(id);
    return user;
  }

  @Query('users')
  getAllUsers() {
    const users: User[] | undefined = this.authService.getAllUsers();
    return users;
  }

  @Mutation('googleLogin')
  googleLogin(
    @Args('googleId') id: string,
    @Args('email') email: string,
    @Args('pseudo') pseudo: string,
  ) {
    const user: User = this.authService.findOrCreateUser({
      googleId: id,
      email,
      pseudo,
    });

    const accessToken = this.authService.getJwtToken(user);

    return {
      user: user,
      accessToken: accessToken,
    };
  }
}
