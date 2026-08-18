import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@Directive('@key(fields: "googleId")')
@ObjectType()
export class User {
  @Field(() => ID)
  googleId?: string;
}
