import { PartialType, PickType } from '@nestjs/mapped-types';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'El contenido es obligatorio' })
  @MaxLength(2000, { message: 'El contenido no puede exceder 2000 caracteres' })
  content: string;

  // Exactamente uno de articleId / postId, salvo que se responda a otro comentario
  @IsOptional()
  @IsInt({ message: 'articleId debe ser un entero' })
  articleId?: number;

  @IsOptional()
  @IsInt({ message: 'postId debe ser un entero' })
  postId?: number;

  @IsOptional()
  @IsInt({ message: 'parentCommentId debe ser un entero' })
  parentCommentId?: number;
}

// Solo el texto es editable
export class UpdateCommentDto extends PartialType(
  PickType(CreateCommentDto, ['content'] as const),
) {}