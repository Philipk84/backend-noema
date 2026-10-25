import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Article } from '../../entities/article.entity';

@Entity('article_tags')
export class ArticleTag {
  @PrimaryColumn({ name: 'article_id' })
  articleId: number;

  @PrimaryColumn({ length: 50 })
  tag: string;

  @ManyToOne(() => Article, (articleObj) => articleObj.articleTags, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'article_id' })
  article: Article;
}