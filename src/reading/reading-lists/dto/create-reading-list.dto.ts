import { PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ReadingListStatus,
  ReadingListVisibility,
} from '../../enums/reading-list-status.enum';

export class CreateReadingListDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre no puede exceder 100 caracteres' })
  name: string;

  @IsOptional()
  @IsEnum(ReadingListStatus, {
    message: 'El estado debe ser WANT_TO_READ, READING, READ o CUSTOM',
  })
  status?: ReadingListStatus;

  @IsOptional()
  @IsEnum(ReadingListVisibility, {
    message: 'La visibilidad debe ser PUBLIC o PRIVATE',
  })
  visibility?: ReadingListVisibility;
}

export class UpdateReadingListDto extends PartialType(CreateReadingListDto) {}

export class ReorderReadingListItemsDto {
  @IsArray({ message: 'articleIds debe ser un arreglo' })
  @ArrayUnique({ message: 'articleIds no puede repetir artículos' })
  @IsInt({ each: true, message: 'Cada articleId debe ser un entero' })
  articleIds: number[];
}

export class AddReadingListItemDto {
  @IsInt({ message: 'articleId debe ser un entero' })
  articleId: number;
}
