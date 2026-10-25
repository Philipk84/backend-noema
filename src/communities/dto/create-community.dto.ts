import { OmitType, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'El tema es obligatorio' })
  @MaxLength(100, { message: 'El tema no puede exceder 100 caracteres' })
  topic: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsArray({ message: 'tags debe ser un arreglo' })
  @ArrayMaxSize(10, { message: 'Una comunidad admite máximo 10 etiquetas' })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'Cada etiqueta admite máximo 50 caracteres',
  })
  tags?: string[];
}

// Las etiquetas se editan por su propio endpoint
export class UpdateCommunityDto extends PartialType(
  OmitType(CreateCommunityDto, ['tags'] as const),
) {}

export class ReplaceCommunityTagsDto {
  @IsArray({ message: 'tags debe ser un arreglo' })
  @ArrayMaxSize(10, { message: 'Una comunidad admite máximo 10 etiquetas' })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'Cada etiqueta admite máximo 50 caracteres',
  })
  tags: string[];
}

export class FindCommunitiesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  // Coincidencia parcial en el nombre
  @IsOptional()
  @IsString()
  search?: string;
}
