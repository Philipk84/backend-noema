import { IsEnum } from 'class-validator';
import { ArticleStatus } from '../enums/article-status.enum';

export class UpdateArticleStatusDto {
  @IsEnum(ArticleStatus, {
    message: 'El estado debe ser DRAFT, PUBLISHED o ARCHIVED',
  })
  status: ArticleStatus;
}
