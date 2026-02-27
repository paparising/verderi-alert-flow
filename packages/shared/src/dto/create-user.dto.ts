import { IsEmail, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  address: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsOptional()
  role?: 'user' | 'admin';

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
