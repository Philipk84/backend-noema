import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { CommentNotFoundException } from '../../common/exceptions';
import {
  CommentCreatedEvent,
  NotificationEvents,
} from '../../notifications/events/notification.events';
import { ProfilesService } from '../../profiles/profiles.service';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
    private readonly postsService: PostsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    userId: number,
    createCommentDto: CreateCommentDto,
  ): Promise<Comment> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const { articleId, postId, parentAuthorId } =
      await this.resolveTarget(createCommentDto);

    let ownerId: number;
    if (articleId !== null) {
      ownerId = (await this.articlesService.findPublishedOne(articleId, userId))
        .authorId;
    } else {
      ownerId = (await this.postsService.findVisible(postId!, userId)).ownerId;
    }

    const savedCommentObj = await this.dataSource.transaction(
      async (manager) => {
        const commentObj = await manager.save(
          manager.create(Comment, {
            authorId: profileObj.id,
            articleId,
            postId,
            parentCommentId: createCommentDto.parentCommentId ?? null,
            content: createCommentDto.content,
          }),
        );
        if (postId !== null) {
          await manager.increment(Post, { id: postId }, 'commentCount', 1);
        }
        return commentObj;
      },
    );

    await this.eventEmitter.emitAsync(NotificationEvents.COMMENT_CREATED, {
      commentId: savedCommentObj.id,
      actorId: profileObj.id,
      ownerId,
      parentAuthorId,
    } satisfies CommentCreatedEvent);
    return savedCommentObj;
  }

  async findByArticle(
    articleId: number,
    userId: number | null,
    query: PaginationQueryDto,
  ): Promise<Paginated<Comment>> {
    await this.articlesService.findPublishedOne(articleId, userId);
    return await this.paginate({ articleId }, query);
  }

  async findByPost(
    postId: number,
    userId: number | null,
    query: PaginationQueryDto,
  ): Promise<Paginated<Comment>> {
    await this.postsService.findVisible(postId, userId);
    return await this.paginate({ postId }, query);
  }

  async findOne(id: number): Promise<Comment> {
    const commentObj = await this.commentRepository.findOneBy({ id });
    if (!commentObj) {
      throw new CommentNotFoundException(id);
    }
    return commentObj;
  }

  /** Comentario cuyo artículo o publicación sigue disponible para el lector. */
  async findAccessible(id: number, userId: number | null): Promise<Comment> {
    const commentObj = await this.findOne(id);
    if (commentObj.articleId !== null) {
      await this.articlesService.findPublishedOne(commentObj.articleId, userId);
    } else {
      await this.postsService.findVisible(commentObj.postId!, userId);
    }
    return commentObj;
  }

  async update(
    userId: number,
    id: number,
    updateCommentDto: UpdateCommentDto,
  ): Promise<Comment> {
    const commentObj = await this.findOwned(userId, id);
    this.commentRepository.merge(commentObj, updateCommentDto);
    return await this.commentRepository.save(commentObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const commentObj = await this.findOwned(userId, id);

    await this.dataSource.transaction(async (manager) => {
      if (commentObj.postId !== null) {
        // Al borrar un comentario se borran en cascada sus respuestas
        const [{ count: removedComments }] = await manager.query<
          { count: number }[]
        >(
          `WITH RECURSIVE comment_tree AS (
             SELECT id FROM comments WHERE id = $1
             UNION ALL
             SELECT c.id FROM comments c
             INNER JOIN comment_tree t ON c.parent_comment_id = t.id
           )
           SELECT COUNT(*)::int AS count FROM comment_tree`,
          [commentObj.id],
        );
        await manager.decrement(
          Post,
          { id: commentObj.postId },
          'commentCount',
          removedComments,
        );
      }
      await manager.remove(Comment, commentObj);
    });
    return { message: `Comment with id #${id} deleted successfully` };
  }

  /** Determina el artículo o la publicación comentados, heredándolos del padre si es una respuesta. */
  private async resolveTarget(createCommentDto: CreateCommentDto): Promise<{
    articleId: number | null;
    postId: number | null;
    parentAuthorId: number | null;
  }> {
    const articleId = createCommentDto.articleId ?? null;
    const postId = createCommentDto.postId ?? null;

    if (createCommentDto.parentCommentId !== undefined) {
      const parentCommentObj = await this.findOne(
        createCommentDto.parentCommentId,
      );
      const mismatchesParent =
        (articleId !== null && articleId !== parentCommentObj.articleId) ||
        (postId !== null && postId !== parentCommentObj.postId);
      if (mismatchesParent) {
        throw new BadRequestException(
          'La respuesta debe pertenecer al mismo recurso que el comentario padre',
        );
      }
      return {
        articleId: parentCommentObj.articleId,
        postId: parentCommentObj.postId,
        parentAuthorId: parentCommentObj.authorId,
      };
    }

    if ((articleId === null) === (postId === null)) {
      throw new BadRequestException(
        'Indica exactamente uno de articleId o postId',
      );
    }
    return { articleId, postId, parentAuthorId: null };
  }

  private async findOwned(userId: number, id: number): Promise<Comment> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const commentObj = await this.findOne(id);
    if (commentObj.authorId !== profileObj.id) {
      throw new ForbiddenException('Este comentario pertenece a otro perfil');
    }
    return commentObj;
  }

  private async paginate(
    where: { articleId: number } | { postId: number },
    query: PaginationQueryDto,
  ): Promise<Paginated<Comment>> {
    const [data, total] = await this.commentRepository.findAndCount({
      where,
      relations: { author: true },
      order: { createdAt: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }
}