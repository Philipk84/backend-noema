import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../articles.service';
import { ReplaceArticleTagsDto } from './dto/replace-article-tag.dto';
import { ArticleTag } from './entities/article-tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(ArticleTag)
    private readonly articleTagRepository: Repository<ArticleTag>,
    private readonly articlesService: ArticlesService,
  ) {}

  /** Etiquetas en uso en artículos publicados, de la más usada a la menos usada. */
  async findAllInUse(): Promise<{ tag: string; articles: number }[]> {
    const rows = await this.articleTagRepository
      .createQueryBuilder('articleTag')
      .innerJoin('articleTag.article', 'article')
      .where("article.status = 'PUBLISHED'")
      // Las etiquetas de artículos exclusivos de una comunidad no son públicas
      .andWhere('article.communityId IS NULL')
      .select('articleTag.tag', 'tag')
      .addSelect('COUNT(*)', 'articles')
      .groupBy('articleTag.tag')
      .orderBy('articles', 'DESC')
      .addOrderBy('articleTag.tag', 'ASC')
      .getRawMany<{ tag: string; articles: string }>();

    return rows.map((row) => ({
      tag: row.tag,
      articles: Number(row.articles),
    }));
  }

  async findByArticle(
    articleId: number,
    userId: number | null,
  ): Promise<string[]> {
    await this.articlesService.findPublishedOne(articleId, userId);
    return await this.listTags(articleId);
  }

  /** Reemplaza todas las etiquetas del artículo, solo su autor puede hacerlo. */
  async replaceForArticle(
    userId: number,
    articleId: number,
    replaceArticleTagsDto: ReplaceArticleTagsDto,
  ): Promise<string[]> {
    const articleObj = await this.articlesService.findOwned(userId, articleId);
    // Se normaliza para que "NestJS" y "nestjs" sean la misma etiqueta
    const tags = [
      ...new Set(
        replaceArticleTagsDto.tags.map((tag) => tag.trim().toLowerCase()),
      ),
    ].filter((tag) => tag.length > 0);

    await this.articleTagRepository.delete({ articleId: articleObj.id });
    const articleTagObjs = tags.map((tag) =>
      this.articleTagRepository.create({ articleId: articleObj.id, tag }),
    );
    await this.articleTagRepository.save(articleTagObjs);
    return await this.listTags(articleObj.id);
  }

  private async listTags(articleId: number): Promise<string[]> {
    const articleTagObjs = await this.articleTagRepository.find({
      where: { articleId },
      order: { tag: 'ASC' },
    });
    return articleTagObjs.map((articleTagObj) => articleTagObj.tag);
  }
}