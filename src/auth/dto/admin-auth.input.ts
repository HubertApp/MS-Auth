import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

@InputType()
export class AdminAuthInput {
  @Field()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @Field()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;
}
