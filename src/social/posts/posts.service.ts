import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { PostNotFoundException } from '../../common/exceptions/http/post-not-found.exception';
import { MembershipsService } from '../../communities/memberships/memberships.service';
import {
  NotificationEvents,
  PostCreatedEvent,
} from '../../notifications/events/notification.events';
import { FollowsService } from '../../profiles/follows/follows.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { PostType, PostVisibility } from '../enums/post.enums';
import { CreatePostDto, FindPostsQueryDto } from './dto/create-post.dto';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
    private readonly followsService: FollowsService,
    private readonly membershipsService: MembershipsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: number, createPostDto: CreatePostDto): Promise<Post> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const postType = createPostDto.postType ?? PostType.ORIGINAL;
    const content = createPostDto.content?.trim() || null;
    this.assertValidShape(postType, content, createPostDto.parentPostId);

    const parentPostObj =
      createPostDto.parentPostId === undefined
        ? null
        : await this.findVisible(createPostDto.parentPostId, userId);

    if (parentPostObj) {
      await this.assertCanBuildOn(profileObj.id, postType, parentPostObj);
    }

    // Una respuesta a un post de comunidad se queda dentro de esa comunidad
    const { visibility, communityId } = this.resolveVisibility(
      createPostDto,
      postType,
      parentPostObj,
    );
    if (communityId !== null) {
      await this.membershipsService.assertActiveMember(
        communityId,
        profileObj.id,
      );
    }
    if (createPostDto.articleId !== undefined) {
      await this.articlesService.findPublishedOne(
        createPostDto.articleId,
        userId,
      );
    }

    const postObj = await this.dataSource.transaction(async (manager) => {
      const savedPostObj = await manager.save(
        manager.create(Post, {
          ownerId: profileObj.id,
          articleId: createPostDto.articleId ?? null,
          parentPostId: parentPostObj?.id ?? null,
          postType,
          content,
          visibility,
          communityId,
        }),
      );
      if (parentPostObj) {
        await manager.increment(
          Post,
          { id: parentPostObj.id },
          this.counterFor(postType),
          1,
        );
      }
      return savedPostObj;
    });
    await this.eventEmitter.emitAsync(NotificationEvents.POST_CREATED, {
      postId: postObj.id,
      actorId: profileObj.id,
      postType,
      communityId,
      parentOwnerId: parentPostObj?.ownerId ?? null,
    } satisfies PostCreatedEvent);
    return await this.findVisible(postObj.id, userId);
  }

  /** Feed: publicaciones de primer nivel visibles para el lector, de la más reciente a la más antigua. */
  async findFeed(
    userId: number | null,
    query: FindPostsQueryDto,
  ): Promise<Paginated<Post>> {
    const viewerProfileId = await this.resolveViewerProfileId(userId);
    const queryBuilder = this.buildBaseQuery(viewerProfileId).andWhere(
      'post.postType != :replyType',
      { replyType: PostType.REPLY },
    );
    if (query.authorId !== undefined) {
      queryBuilder.andWhere('post.ownerId = :authorId', {
        authorId: query.authorId,
      });
    }
    if (query.communityId !== undefined) {
      queryBuilder.andWhere('post.communityId = :communityId', {
        communityId: query.communityId,
      });
    }
    return await this.paginate(
      queryBuilder.orderBy('post.createdAt', 'DESC'),
      query,
    );
  }

  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Post>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.owner', 'owner')
      .leftJoinAndSelect('post.article', 'article')
      .where('post.ownerId = :ownerId', { ownerId: profileObj.id })
      .orderBy('post.createdAt', 'DESC');
    return await this.paginate(queryBuilder, query);
  }

  async findReplies(
    id: number,
    userId: number | null,
    query: PaginationQueryDto,
  ): Promise<Paginated<Post>> {
    await this.findVisible(id, userId);
    const viewerProfileId = await this.resolveViewerProfileId(userId);
    const queryBuilder = this.buildBaseQuery(viewerProfileId)
      .andWhere('post.parentPostId = :id', { id })
      .andWhere('post.postType = :replyType', { replyType: PostType.REPLY })
      .orderBy('post.createdAt', 'ASC');
    return await this.paginate(queryBuilder, query);
  }

  /** Publicación visible para el lector; si no lo es, se comporta como inexistente. */
  async findVisible(id: number, userId: number | null): Promise<Post> {
    const postObj = await this.postRepository.findOne({
      where: { id },
      relations: { owner: true, article: true },
    });
    if (!postObj) {
      throw new PostNotFoundException(id);
    }

    const viewerProfileId = await this.resolveViewerProfileId(userId);
    if (!(await this.canView(postObj, viewerProfileId))) {
      throw new PostNotFoundException(id);
    }
    return postObj;
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const postObj = await this.findVisible(id, userId);
    if (postObj.ownerId !== profileObj.id) {
      throw new ForbiddenException('Esta publicación pertenece a otro perfil');
    }

    await this.dataSource.transaction(async (manager) => {
      if (postObj.parentPostId !== null) {
        await manager.decrement(
          Post,
          { id: postObj.parentPostId },
          this.counterFor(postObj.postType),
          1,
        );
      }
      await manager.remove(Post, postObj);
    });
    return { message: `Post with id #${id} deleted successfully` };
  }

  private assertValidShape(
    postType: PostType,
    content: string | null,
    parentPostId: number | undefined,
  ): void {
    if (postType === PostType.ORIGINAL) {
      if (!content) {
        throw new BadRequestException(
          'Una publicación original requiere contenido',
        );
      }
      if (parentPostId !== undefined) {
        throw new BadRequestException(
          'Una publicación original no puede tener parentPostId',
        );
      }
      return;
    }

    if (parentPostId === undefined) {
      throw new BadRequestException(`Un ${postType} requiere parentPostId`);
    }
    if (postType === PostType.REPOST && content) {
      throw new BadRequestException(
        'Un repost no lleva contenido; usa QUOTE para citar con comentario',
      );
    }
    if (postType !== PostType.REPOST && !content) {
      throw new BadRequestException(`Un ${postType} requiere contenido`);
    }
  }

  private async assertCanBuildOn(
    profileId: number,
    postType: PostType,
    parentPostObj: Post,
  ): Promise<void> {
    if (postType !== PostType.REPOST && postType !== PostType.QUOTE) {
      return;
    }
    if (parentPostObj.postType === PostType.REPOST) {
      throw new BadRequestException(
        'No se puede republicar ni citar un repost; hazlo sobre la publicación original',
      );
    }
    if (
      parentPostObj.visibility !== PostVisibility.PUBLIC &&
      parentPostObj.ownerId !== profileId
    ) {
      throw new ForbiddenException(
        'Solo se pueden republicar o citar publicaciones públicas',
      );
    }
    if (postType === PostType.REPOST) {
      const existingRepostObj = await this.postRepository.findOneBy({
        ownerId: profileId,
        parentPostId: parentPostObj.id,
        postType: PostType.REPOST,
      });
      if (existingRepostObj) {
        throw new ConflictException('Ya republicaste esta publicación');
      }
    }
  }

  /**
   * Visibilidad y comunidad finales del post. COMMUNITY y communityId van
   * siempre juntos, y una respuesta a un post de comunidad hereda la comunidad.
   */
  private resolveVisibility(
    createPostDto: CreatePostDto,
    postType: PostType,
    parentPostObj: Post | null,
  ): { visibility: PostVisibility; communityId: number | null } {
    if (
      postType === PostType.REPLY &&
      parentPostObj?.visibility === PostVisibility.COMMUNITY
    ) {
      return {
        visibility: PostVisibility.COMMUNITY,
        communityId: parentPostObj.communityId,
      };
    }

    const communityId = createPostDto.communityId ?? null;
    const visibility =
      createPostDto.visibility ??
      (communityId === null ? PostVisibility.PUBLIC : PostVisibility.COMMUNITY);
    if (visibility === PostVisibility.COMMUNITY && communityId === null) {
      throw new BadRequestException(
        'La visibilidad COMMUNITY requiere communityId',
      );
    }
    if (visibility !== PostVisibility.COMMUNITY && communityId !== null) {
      throw new BadRequestException(
        'Un post con communityId debe tener visibilidad COMMUNITY',
      );
    }
    return { visibility, communityId };
  }

  /** Contador del padre que aumenta según el tipo de publicación hija. */
  private counterFor(postType: PostType): 'commentCount' | 'repostCount' {
    return postType === PostType.REPLY ? 'commentCount' : 'repostCount';
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

  private async canView(
    postObj: Post,
    viewerProfileId: number | null,
  ): Promise<boolean> {
    if (postObj.visibility === PostVisibility.PUBLIC) {
      return true;
    }
    if (viewerProfileId === null) {
      return false;
    }
    if (viewerProfileId === postObj.ownerId) {
      return true;
    }
    if (postObj.visibility === PostVisibility.COMMUNITY) {
      return await this.membershipsService.isActiveMember(
        postObj.communityId!,
        viewerProfileId,
      );
    }
    return await this.followsService.isFollowing(
      viewerProfileId,
      postObj.ownerId,
    );
  }

  /** Consulta base con la regla de visibilidad aplicada para el lector. */
  private buildBaseQuery(
    viewerProfileId: number | null,
  ): SelectQueryBuilder<Post> {
    const queryBuilder = this.postRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.owner', 'owner')
      .leftJoinAndSelect('post.article', 'article');

    if (viewerProfileId === null) {
      return queryBuilder.where('post.visibility = :publicVisibility', {
        publicVisibility: PostVisibility.PUBLIC,
      });
    }
    return queryBuilder.where(
      `(post.visibility = :publicVisibility
        OR post.ownerId = :viewerProfileId
        OR (post.visibility = :followersVisibility
            AND EXISTS (SELECT 1 FROM follows viewer_follow
                        WHERE viewer_follow.follower_id = :viewerProfileId
                          AND viewer_follow.followed_id = post.owner_id))
        OR (post.visibility = :communityVisibility
            AND EXISTS (SELECT 1 FROM memberships viewer_membership
                        WHERE viewer_membership.community_id = post.community_id
                          AND viewer_membership.profile_id = :viewerProfileId
                          AND viewer_membership.status = 'ACTIVE')))`,
      {
        publicVisibility: PostVisibility.PUBLIC,
        followersVisibility: PostVisibility.FOLLOWERS,
        communityVisibility: PostVisibility.COMMUNITY,
        viewerProfileId,
      },
    );
  }

  private async paginate(
    queryBuilder: SelectQueryBuilder<Post>,
    query: PaginationQueryDto,
  ): Promise<Paginated<Post>> {
    const [data, total] = await queryBuilder
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }
}