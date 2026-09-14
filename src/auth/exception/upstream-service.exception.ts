import { GraphQLError } from 'graphql';

export class UpstreamServiceException extends GraphQLError {
  constructor(message: string, service?: string) {
    super(message, {
      extensions: {
        code: 'UPSTREAM_SERVICE_UNAVAILABLE',
        ...(service ? { service } : {}),
        http: { status: 503 },
      },
    });

    this.name = 'UpstreamServiceException';
  }
}
