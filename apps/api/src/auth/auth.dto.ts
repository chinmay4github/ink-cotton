import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9]{10,15}$/, { message: 'phone must be 10-15 digits' }) phone?: string;
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain a letter and a number' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email or phone' }) @IsString() identifier: string;
  @ApiProperty() @IsString() password: string;
  /** Each app (shop / sell / deliver / admin) only accepts its own kind of account. */
  @ApiPropertyOptional({ enum: ['customer', 'vendor', 'delivery_agent', 'admin'] })
  @IsOptional()
  @IsIn(['customer', 'vendor', 'delivery_agent', 'admin'])
  role?: 'customer' | 'vendor' | 'delivery_agent' | 'admin';
}

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(120) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\+?[0-9]{10,15}$/) phone?: string;
}
