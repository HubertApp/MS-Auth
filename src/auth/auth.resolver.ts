// import { Resolver } from '@nestjs/graphql';
// import { AuthService } from './auth.service';
// import { Auth } from './entities/auth.entity';
// // import { User } from './entities/user.entity';

// @Resolver(() => Auth)
// export class AuthResolver {
//   constructor(private authService: AuthService) {}

//   // @Query(() => String)
//   // hello(): string {
//   //   return 'Hello from Auth Service!';
//   // }

//   // @Mutation(() => User)
//   // async refreshToken(
//   //   @Args('refreshToken') refreshToken: string,
//   // ): Promise<string> {
//   //   return 'this.authService.refreshToken(refreshToken);';
//   // }

//   // Faudra que j'ajoute une fonction pour le refresh token plus tard / actuellement jeton JWT avec expiration simple renvoyer via controller REST
// }
