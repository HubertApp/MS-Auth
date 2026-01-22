import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../entities/user.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request & { user?: User } {
    const ctx: GqlExecutionContext = GqlExecutionContext.create(context);
    const ctxContext: { req: Request & { user?: User } } = ctx.getContext();
    return ctxContext.req;
  }
}
