import { PartialType, OmitType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: 'articleId debe ser un entero' })
  articleId: number;

  @IsInt({ message: 'La calificación debe ser un entero' })
  @Min(1, { message: 'La calificación mínima es 1' })
  @Max(5, { message: 'La calificación máxima es 5' })
  rating: number;

  @IsOptional()
  @IsString()
  reviewText?: string;
}

// El artículo reseñado no se puede cambiar
export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['articleId'] as const),
) {}
