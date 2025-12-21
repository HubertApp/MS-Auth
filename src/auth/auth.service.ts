import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// import { GraphQLClient, gql } from 'graphql-request';
import { User } from './entities/user.entity';
import { CreateAuthInput } from './dto/create-auth.input';

@Injectable()
export class AuthService {
  private users: User[] = [];
  constructor(private jwtService: JwtService) {
    this.users = [{ id: '1', email: 'test@gmail.com', pseudo: 'Adel' }];
  }

  findOrCreateUser(user: CreateAuthInput): User {
    let cli = this.users.find((u) => u.email === user.email);
    //   const client = new GraphQLClient('http://localhost:3002/graphql');

    //   const cli = client.request(gql`
    //   query {
    //     getByEmail(userId: "${user.email}") {
    //       id
    //       total
    //     }
    //   }
    // `);

    if (!cli) {
      cli = {
        id: user.googleId,
        email: user.email,
        pseudo: user.pseudo,
      };
      this.users.push(cli);
      console.log('Inscription:', cli);
    } else {
      console.log('Connexion:', cli);
    }

    return cli;
  }

  findById(id: string) {
    const user: User | undefined = this.users.find((u) => u.id === id);
    return user;
  }

  findByEmail(email: string) {
    return this.users.find((u) => u.email === email);
  }

  getAllUsers() {
    const users: User[] = this.users;
    return users;
  }

  getJwtToken(user: User) {
    const payload = {
      email: user.email,
      sub: user.id,
      pseudo: user.pseudo,
    };
    return this.jwtService.sign(payload);
  }
}
