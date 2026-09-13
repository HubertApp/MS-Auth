import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient, gql } from 'graphql-request';
import { CreateAuthInput } from './dto/create-auth.input';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AdminAuthInput } from './dto/admin-auth.input';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async findOrCreateUser(user: CreateAuthInput): Promise<any> {
    const client = new GraphQLClient(process.env.MS_USER_LINK || 'http://service-user:3001/graphql'  );

    const CREATE_USER_MUTATION = gql`
      mutation CreateUser($input: CreateUserInput!) {
        createUser(createUserInput: $input) {
          googleId
          email
          pseudo
          photo
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
          photo: user.photo,
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


  async findUserAdmin(userAdmin: AdminAuthInput): Promise<any> {
    const client = new GraphQLClient('http://service-admin-user:3011/graphql');

    const FIND_ADMIN_QUERY = gql`
      query FindUser($input: AdminAuthInput!) {
        authAdminUserByUserAndPassword(adminUserInput: $input) {
          email
          pseudo
          age
          role
        }
      }
    `;

    try {
      const response: any = await client.request(FIND_ADMIN_QUERY, {
        input: {
          email: userAdmin.email,
          password: userAdmin.password,
        },
      });

      return response.authAdminUserByUserAndPassword;
    } catch (error) {
      console.error("Erreur lors de l'appel à MS-User: " + error);
      throw new Error(
        "Impossible de synchroniser l'utilisateur avec MS-User-Admin : " + error,
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

  getJwks() {
    const publicKeyPem = this.configService
      .get<string>('JWT_PUBLIC_KEY')!
      .replace(/\\n/g, '\n');

    const publicKey = crypto.createPublicKey(publicKeyPem);
    const jwk = publicKey.export({ format: 'jwk' });

    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid: 'auth-key-1',
        },
      ],
    };
  }
}
