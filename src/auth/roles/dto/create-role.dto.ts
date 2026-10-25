import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @IsString({ message: 'El nombre del rol debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del rol es obligatorio' })
  @MaxLength(50, {
    message: 'El nombre del rol no puede exceder 50 caracteres',
  })
  roleName: string;

  @IsOptional()
  @IsArray({ message: 'permissionIds debe ser un arreglo' })
  @ArrayUnique()
  @IsInt({ each: true, message: 'Cada permissionId debe ser un entero' })
  permissionIds?: number[];
}
