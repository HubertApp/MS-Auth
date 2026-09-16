import { GraphQLError } from 'graphql';

export class InvalidCredentialsException extends GraphQLError {
  constructor(message: string = 'Identifiants invalides') {
    super(message, {
      extensions: {
        code: 'INVALID_CREDENTIALS',
        http: { status: 401 },
      },
    });

    this.name = 'InvalidCredentialsException';
  }
}
