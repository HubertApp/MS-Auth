import { GraphQLError } from 'graphql';


export class ServiceMisconfiguredException extends GraphQLError {
  constructor(message: string = 'Service mal configuré') {
    super(message, {
      extensions: {
        code: 'SERVICE_MISCONFIGURED',
        http: { status: 500 },
      },
    });

    this.name = 'ServiceMisconfiguredException';
  }
}
