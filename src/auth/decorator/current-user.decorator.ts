import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { CreateAuthInput } from '../dto/create-auth.input';

export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    const userId: string = request.headers['x-user-id'] as string;
    const role: string = request.headers['x-user-role'] as string;
    const email: string = request.headers['x-user-email'] as string;
    const pseudo: string = request.headers['x-user-pseudo'] as string;
    const age: number = request.headers['x-user-age'] as number;
    if (!userId) {
      throw new Error('User ID not found in request headers');
    }

    const user: CreateAuthInput = {
      googleId: userId,
      email: email,
      pseudo: pseudo,
      age: age,
      role: role,
    };

    return user;
  },
);
