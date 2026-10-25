import { PartialType, PickType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateBookmarkDto {
  @IsInt({ message: 'articleId debe ser un entero' })
  articleId: number;

  @IsString()
  @IsNotEmpty({ message: 'El fragmento subrayado es obligatorio' })
  highlightedText: string;

  @IsInt()
  @Min(0, { message: 'startPosition no puede ser negativa' })
  startPosition: number;

  @IsInt()
  @Min(1, { message: 'endPosition debe ser mayor que 0' })
  endPosition: number;

  @IsOptional()
  @IsString()
  note?: string;
}

// Solo la nota es editable; el fragmento y su posición quedan fijos
export class UpdateBookmarkDto extends PartialType(
  PickType(CreateBookmarkDto, ['note'] as const),
) {}

export class FindBookmarksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  articleId?: number;
}
