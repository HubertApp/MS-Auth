import { Resolver } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { Auth } from './entities/auth.entity';
// import { CreateAuthInput } from './dto/create-auth.input';

@Resolver(() => Auth)
export class AuthResolver {
  constructor(private authService: AuthService) {}

  // @Mutation(() => Auth)
  // async googleLogin(
  //   @Args('googleId') googleId: string,
  //   @Args('email') email: string,
  //   @Args('pseudo') pseudo: string,
  //   @Args('age') age: number,
  //   @Args('role') role: string,
  // ) {
  //   const user: CreateAuthInput = await this.authService.findOrCreateUser({
  //     googleId,
  //     email,
  //     pseudo,
  //     age,
  //     role,
  //   });

  //   const accessToken = this.authService.getJwtToken(user);

  //   return {
  //     accessToken: accessToken,
  //   };
  // }
}
