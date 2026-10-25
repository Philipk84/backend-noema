import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PostType, PostVisibility } from '../../enums/post.enums';

export class CreatePostDto {
  @IsOptional()
  @IsEnum(PostType, {
    message: 'El tipo debe ser ORIGINAL, REPLY, REPOST o QUOTE',
  })
  postType?: PostType;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'El contenido no puede exceder 2000 caracteres' })
  content?: string;

  @IsOptional()
  @IsInt({ message: 'articleId debe ser un entero' })
  articleId?: number;

  @IsOptional()
  @IsInt({ message: 'parentPostId debe ser un entero' })
  parentPostId?: number;

  // Publicar en una comunidad implica visibilidad COMMUNITY (y viceversa)
  @IsOptional()
  @IsInt({ message: 'communityId debe ser un entero' })
  communityId?: number;

  @IsOptional()
  @IsEnum(PostVisibility, {
    message: 'La visibilidad debe ser PUBLIC, FOLLOWERS o COMMUNITY',
  })
  visibility?: PostVisibility;
}

export class FindPostsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  communityId?: number;
}