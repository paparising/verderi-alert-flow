import { IsEmail, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNotEmpty()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsNotEmpty()
  phone?: string;

  @IsOptional()
  @IsNotEmpty()
  role?: 'user' | 'admin';

  @IsOptional()
  @IsNotEmpty()
  @MinLength(8)
  password?: string;
}
