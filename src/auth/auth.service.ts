import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient, gql } from 'graphql-request';
import { CreateAuthInput } from './dto/create-auth.input';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async findOrCreateUser(user: CreateAuthInput): Promise<any> {
    const client = new GraphQLClient('http://localhost:3001/graphql');

    const CREATE_USER_MUTATION = gql`
      mutation CreateUser($input: CreateUserInput!) {
        createUser(createUserInput: $input) {
          googleId
          email
          pseudo
          age
          role
        }
      }
    `;

    try {
      const response: any = await client.request(CREATE_USER_MUTATION, {
        input: {
          googleId: user.googleId,
          email: user.email,
          pseudo: user.pseudo,
          age: user.age,
          role: user.role,
        },
      });

      return response.createUser;
    } catch (error) {
      console.error("Erreur lors de l'appel à MS-User: " + error);
      throw new Error(
        "Impossible de synchroniser l'utilisateur avec MS-User : " + error,
      );
    }
  }

  getJwtToken(user: CreateAuthInput) {
    const payload = {
      email: user.email,
      sub: user.googleId,
      pseudo: user.pseudo,
      role: user.role,
      age: user.age,
    };
    return this.jwtService.sign(payload);
  }

  createRefreshToken(user: CreateAuthInput) {
    const payload = {
      sub: user.googleId,
    };
    return this.jwtService.sign(payload, {
      secret: 'refreshSecretKey',
      expiresIn: '7d',
    });
  }
}
