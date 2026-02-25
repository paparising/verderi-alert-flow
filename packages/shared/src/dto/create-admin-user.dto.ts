import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateAdminUserDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  address: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  phone: string;

  @IsUUID()
  organizationId: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  role?: 'admin' | 'user';
}