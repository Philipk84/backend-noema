import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    description:
      'Nombre de usuario único. Solo admite letras, números, guion bajo y punto',
    example: 'maria.lopez',
    minLength: 3,
    maxLength: 50,
    pattern: '^[a-zA-Z0-9_.]+$',
  })
  @IsString()
  @MinLength(3, { message: 'El username debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El username no puede exceder 50 caracteres' })
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message: 'El username solo admite letras, números, guion bajo y punto',
  })
  username: string;

  @ApiProperty({
    description: 'Nombre visible del perfil',
    example: 'María López',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @ApiPropertyOptional({
    description: 'URL de la foto de perfil',
    example: 'https://example.com/avatars/maria.png',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl({}, { message: 'La foto de perfil debe ser una URL válida' })
  @MaxLength(500)
  profilePhoto?: string;

  @ApiPropertyOptional({
    description: 'Biografía del perfil',
    example: 'Escritora y lectora apasionada de ciencia ficción',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La biografía no puede exceder 500 caracteres' })
  bio?: string;

  @ApiPropertyOptional({
    description: 'URL del sitio web personal',
    example: 'https://maria-lopez.dev',
    maxLength: 255,
  })
  @IsOptional()
  @IsUrl({}, { message: 'El sitio web debe ser una URL válida' })
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({
    description: 'Enlaces a redes sociales con el formato { red: url }',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      twitter: 'https://twitter.com/marialopez',
      github: 'https://github.com/marialopez',
    },
  })
  @IsOptional()
  @IsObject({ message: 'socialLinks debe ser un objeto { red: url }' })
  socialLinks?: Record<string, string>;
}
