import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { ArticleNotFoundException } from '../common/exceptions/http/article-not-found.exception';
import { MembershipsService } from '../communities/memberships/memberships.service';
import { SubscriptionsService } from '../monetization/subscriptions/subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { CollectionsService } from './collections/collections.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from './entities/article.entity';
import { ArticleStatus } from './enums/article-status.enum';

// Transiciones de estado permitidas
const ALLOWED_TRANSITIONS: Record<ArticleStatus, ArticleStatus[]> = {
  [ArticleStatus.DRAFT]: [ArticleStatus.PUBLISHED, ArticleStatus.ARCHIVED],
  [ArticleStatus.PUBLISHED]: [ArticleStatus.ARCHIVED],
  [ArticleStatus.ARCHIVED]: [ArticleStatus.PUBLISHED],
};

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    private readonly profilesService: ProfilesService,
    private readonly collectionsService: CollectionsService,
    private readonly membershipsService: MembershipsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(
    userId: number,
    createArticleDto: CreateArticleDto,
  ): Promise<Article> {
    const profileObj = await this.profilesService.findByUserId(userId);
    if (createArticleDto.collectionId != null) {
      await this.collectionsService.findOwned(
        userId,
        createArticleDto.collectionId,
      );
    }
    if (createArticleDto.communityId != null) {
      await this.membershipsService.assertActiveMember(
        createArticleDto.communityId,
        profileObj.id,
      );
    }

    const articleObj = this.articleRepository.create({
      ...createArticleDto,
      authorId: profileObj.id,
    });
    return await this.articleRepository.save(articleObj);
  }

  /** Listado público: solo artículos publicados, del más reciente al más antiguo. */
  async findPublished(
    query: FindArticlesQueryDto,
    userId: number | null,
  ): Promise<Paginated<Article>> {
    const viewerProfileId = await this.resolveViewerProfileId(userId);
    const queryBuilder = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.articleTags', 'articleTag')
      .where('article.status = :status', { status: ArticleStatus.PUBLISHED });

    // Los artículos exclusivos de una comunidad solo los ven sus miembros activos y su autor
    if (viewerProfileId === null) {
      queryBuilder.andWhere('article.communityId IS NULL');
    } else {
      queryBuilder.andWhere(
        `(article.communityId IS NULL
          OR article.authorId = :viewerProfileId
          OR EXISTS (SELECT 1 FROM memberships viewer_membership
                     WHERE viewer_membership.community_id = article.community_id
                       AND viewer_membership.profile_id = :viewerProfileId
                       AND viewer_membership.status = 'ACTIVE'))`,
        { viewerProfileId },
      );
    }
    if (query.communityId !== undefined) {
      queryBuilder.andWhere('article.communityId = :communityId', {
        communityId: query.communityId,
      });
    }

    if (query.authorId !== undefined) {
      queryBuilder.andWhere('article.authorId = :authorId', {
        authorId: query.authorId,
      });
    }
    if (query.collectionId !== undefined) {
      queryBuilder.andWhere('article.collectionId = :collectionId', {
        collectionId: query.collectionId,
      });
    }
    if (query.tag) {
      // Subconsulta para no recortar las etiquetas que se devuelven con el artículo
      queryBuilder.andWhere(
        `EXISTS (SELECT 1 FROM article_tags filter_tag
                 WHERE filter_tag.article_id = article.id AND filter_tag.tag = :tag)`,
        { tag: query.tag.trim().toLowerCase() },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('article.publishedAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Detalle público: un borrador, un archivado o un artículo exclusivo de una
   * comunidad a la que el lector no pertenece se comportan como inexistentes.
   */
  async findPublishedOne(id: number, userId: number | null): Promise<Article> {
    const articleObj = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.articleTags', 'articleTag')
      .addSelect('article.content')
      .where('article.id = :id', { id })
      .andWhere('article.status = :status', {
        status: ArticleStatus.PUBLISHED,
      })
      .getOne();
    if (!articleObj) {
      throw new ArticleNotFoundException(id);
    }

    const viewerProfileId = await this.resolveViewerProfileId(userId);
    if (!(await this.canViewWithProfile(articleObj, viewerProfileId))) {
      throw new ArticleNotFoundException(id);
    }

    // Un artículo premium solo se lee completo con el autor o una suscripción vigente a sus planes
    articleObj.locked = false;
    if (articleObj.isPremium && viewerProfileId !== articleObj.authorId) {
      const hasAccess =
        viewerProfileId !== null &&
        (await this.subscriptionsService.hasAccessToAuthor(
          viewerProfileId,
          articleObj.authorId,
        ));
      if (!hasAccess) {
        articleObj.locked = true;
        articleObj.content = this.buildTeaser(articleObj.content);
      }
    }
    return articleObj;
  }

  /** Descarta los elementos cuyo artículo el lector no puede ver (exclusivos de comunidad). */
  async filterViewable<T>(
    items: T[],
    getArticle: (item: T) => Article,
    userId: number | null,
  ): Promise<T[]> {
    const viewerProfileId = await this.resolveViewerProfileId(userId);
    const visibility = await Promise.all(
      items.map((item) =>
        this.canViewWithProfile(getArticle(item), viewerProfileId),
      ),
    );
    return items.filter((_item, index) => visibility[index]);
  }

  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Article>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.articleRepository.findAndCount({
      where: { authorId: profileObj.id },
      relations: { articleTags: true },
      order: { updatedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  /** Artículo del autor autenticado, en cualquier estado. */
  async findOwned(userId: number, id: number): Promise<Article> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const articleObj = await this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.articleTags', 'articleTag')
      .addSelect('article.content')
      .where('article.id = :id', { id })
      .getOne();
    if (!articleObj) {
      throw new ArticleNotFoundException(id);
    }
    if (articleObj.authorId !== profileObj.id) {
      throw new ForbiddenException('Este artículo pertenece a otro autor');
    }
    return articleObj;
  }

  async update(
    userId: number,
    id: number,
    updateArticleDto: UpdateArticleDto,
  ): Promise<Article> {
    const articleObj = await this.findOwned(userId, id);
    if (updateArticleDto.collectionId != null) {
      await this.collectionsService.findOwned(
        userId,
        updateArticleDto.collectionId,
      );
    }
    if (updateArticleDto.communityId != null) {
      await this.membershipsService.assertActiveMember(
        updateArticleDto.communityId,
        articleObj.authorId,
      );
    }
    this.articleRepository.merge(articleObj, updateArticleDto);
    return await this.articleRepository.save(articleObj);
  }

  async changeStatus(
    userId: number,
    id: number,
    status: ArticleStatus,
  ): Promise<Article> {
    const articleObj = await this.findOwned(userId, id);
    if (!ALLOWED_TRANSITIONS[articleObj.status].includes(status)) {
      throw new BadRequestException(
        `No se puede pasar un artículo de ${articleObj.status} a ${status}`,
      );
    }

    articleObj.status = status;
    // La fecha de publicación se fija la primera vez que se publica
    if (status === ArticleStatus.PUBLISHED && !articleObj.publishedAt) {
      articleObj.publishedAt = new Date();
    }
    return await this.articleRepository.save(articleObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const articleObj = await this.findOwned(userId, id);
    await this.articleRepository.remove(articleObj);
    return { message: `Article with id #${id} deleted successfully` };
  }

  /** Adelanto de un artículo premium bloqueado: los primeros caracteres, sin cortar la última palabra. */
  private buildTeaser(content: string): string {
    const TEASER_LENGTH = 280;
    if (content.length <= TEASER_LENGTH) {
      return content;
    }
    const cutAt = content.lastIndexOf(' ', TEASER_LENGTH);
    return `${content.slice(0, cutAt > 0 ? cutAt : TEASER_LENGTH)}…`;
  }

  private async resolveViewerProfileId(
    userId: number | null,
  ): Promise<number | null> {
    if (userId === null) {
      return null;
    }
    const profileObj = await this.profilesService.findByUserIdOrNull(userId);
    return profileObj?.id ?? null;
  }

  private async canViewWithProfile(
    articleObj: Article,
    viewerProfileId: number | null,
  ): Promise<boolean> {
    if (articleObj.communityId === null) {
      return true;
    }
    if (viewerProfileId === null) {
      return false;
    }
    return (
      articleObj.authorId === viewerProfileId ||
      (await this.membershipsService.isActiveMember(
        articleObj.communityId,
        viewerProfileId,
      ))
    );
  }
}
