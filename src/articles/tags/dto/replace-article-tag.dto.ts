import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class ReplaceArticleTagsDto {
  @IsArray({ message: 'tags debe ser un arreglo' })
  @ArrayMaxSize(10, { message: 'Un artículo admite máximo 10 etiquetas' })
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, {
    each: true,
    message: 'Cada etiqueta admite máximo 50 caracteres',
  })
  tags: string[];
}