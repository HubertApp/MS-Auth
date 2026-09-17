import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GraphQLClient, gql } from 'graphql-request';
import { CreateAuthInput } from './dto/create-auth.input';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AdminAuthInput } from './dto/admin-auth.input';
import { InvalidCredentialsException } from './exception/invalid-credentials.exception';
import { UpstreamServiceException } from './exception/upstream-service.exception';
import { ServiceMisconfiguredException } from './exception/service-misconfigured.exception';

type UpstreamErrorLike = {
  response?: { errors?: Array<{ extensions?: { code?: string } }> };
};


const AUTH_FAILURE_CODES = new Set([
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
]);

const upstreamErrors = (error: unknown) =>
  (error as UpstreamErrorLike)?.response?.errors;

const isAuthenticationFailure = (error: unknown): boolean => {
  const errors = upstreamErrors(error);
  return (
    Array.isArray(errors) &&
    errors.some((e) => AUTH_FAILURE_CODES.has(String(e?.extensions?.code)))
  );
};


const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) return 'erreur inconnue';

  const errors = upstreamErrors(error);
  if (Array.isArray(errors)) {
    const codes = errors.map((e) => e?.extensions?.code ?? 'UNKNOWN');
    return `${error.name}, codes upstream: ${codes.join(', ')}`;
  }

  return `${error.name}: ${error.message}`;
};

const maskEmail = (email?: string): string => {
  if (!email) return '<inconnu>';
  const [local, domain] = email.split('@');
  if (!domain) return '<invalide>';
  return `${local.slice(0, 2)}***@${domain}`;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly userServiceUrl: string;
  private readonly adminServiceUrl: string;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.userServiceUrl =
      this.configService.get<string>('MS_USER_LINK') ??
      'http://service-user:3001/graphql';
    this.adminServiceUrl =
      this.configService.get<string>('MS_ADMIN_USER_LINK') ??
      'http://service-admin-user:3011/graphql';
  }

  async findOrCreateUser(user: CreateAuthInput): Promise<CreateAuthInput> {
    const client = new GraphQLClient(this.userServiceUrl);

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

    let response: { createUser?: CreateAuthInput };

    try {
      response = await client.request(CREATE_USER_MUTATION, {
        input: {
          googleId: user.googleId,
          email: user.email,
          pseudo: user.pseudo,
          photo: user.photo,
          age: user.age,
          role: user.role,
        },
      });
    } catch (error) {
      this.logger.error(
        `MS-User injoignable pour ${maskEmail(user.email)} (${describeError(error)})`,
      );
      throw new UpstreamServiceException(
        "Impossible de synchroniser l'utilisateur avec MS-User",
        'MS-User',
      );
    }

    if (!response?.createUser) {
      this.logger.error(
        'MS-User a répondu sans le champ createUser : schéma désynchronisé ?',
      );
      throw new UpstreamServiceException(
        "Impossible de synchroniser l'utilisateur avec MS-User",
        'MS-User',
      );
    }

    this.logger.log(`Utilisateur connecté avec Google : ${maskEmail(user.email)}`);

    return response.createUser;
  }

  async findUserAdmin(userAdmin: AdminAuthInput): Promise<CreateAuthInput> {
    const client = new GraphQLClient(this.adminServiceUrl);

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

    let response: { authAdminUserByUserAndPassword?: CreateAuthInput };

    try {
      response = await client.request(FIND_ADMIN_QUERY, {
        input: {
          email: userAdmin.email,
          password: userAdmin.password,
        },
      });
    } catch (error) {

      if (isAuthenticationFailure(error)) {
        this.logger.warn(
          `Connexion admin refusée pour ${maskEmail(userAdmin.email)}`,
        );
        throw new InvalidCredentialsException();
      }

      this.logger.error(`MS-Admin_user injoignable (${describeError(error)})`);
      throw new UpstreamServiceException(
        'Service administrateur indisponible',
        'MS-Admin_user',
      );
    }

    const admin = response?.authAdminUserByUserAndPassword;
    if (!admin) {
      this.logger.warn(
        `Connexion admin refusée pour ${maskEmail(userAdmin.email)}`,
      );
      throw new InvalidCredentialsException();
    }

    return admin;
  }

  getJwtToken(user: CreateAuthInput): string {

    if (!user?.googleId && !user?.email) {
      this.logger.error(
        "Tentative d'émission d'un token sans identifiant de sujet",
      );
      throw new InvalidCredentialsException(
        "Impossible d'identifier l'utilisateur",
      );
    }

    const payload = {
      email: user.email,
      sub: user.googleId ?? user.email,
      pseudo: user.pseudo,
      role: user.role,
      age: user.age,
    };

    return this.jwtService.sign(payload);
  }

  getJwks() {
    const publicKeyPem = this.configService.get<string>('JWT_PUBLIC_KEY');

    if (!publicKeyPem) {
      this.logger.error('JWT_PUBLIC_KEY absent de la configuration');
      throw new ServiceMisconfiguredException();
    }

    const publicKey = crypto.createPublicKey(
      publicKeyPem.replace(/\\n/g, '\n'),
    );
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
