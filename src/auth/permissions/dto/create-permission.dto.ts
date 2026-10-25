import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString({ message: 'El nombre del permiso debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El nombre del permiso es obligatorio' })
  @MaxLength(50, {
    message: 'El nombre del permiso no puede exceder 50 caracteres',
  })
  permissionName: string;
}
