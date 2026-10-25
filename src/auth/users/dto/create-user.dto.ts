import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Debe ingresar un correo electrónico válido' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener mínimo 8 caracteres' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El teléfono no puede exceder 20 caracteres' })
  phoneNumber?: string;

  @IsArray({ message: 'roleIds debe ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debe especificar al menos un rol' })
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada roleId debe ser un entero' })
  roleIds: number[];
}
