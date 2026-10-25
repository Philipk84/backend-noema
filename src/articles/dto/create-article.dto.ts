import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200, { message: 'El título no puede exceder 200 caracteres' })
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  content: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsInt({ message: 'collectionId debe ser un entero' })
  collectionId?: number | null;

  @IsOptional()
  @IsInt({ message: 'communityId debe ser un entero' })
  communityId?: number | null;
}
