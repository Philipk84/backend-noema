import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, DeepPartial, FindOptionsWhere, Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  NotificationEvents,
  ReactionCreatedEvent,
} from '../../notifications/events/notification.events';
import { ProfilesService } from '../../profiles/profiles.service';
import { CommentsService } from '../comments/comments.service';
import { ReactionTargetType, ReactionType } from '../enums/reaction.enums';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { Reaction } from './entities/reaction.entity';

type TargetColumn = 'articleId' | 'postId' | 'commentId';

const TARGET_COLUMNS: Record<ReactionTargetType, TargetColumn> = {
  [ReactionTargetType.ARTICLE]: 'articleId',
  [ReactionTargetType.POST]: 'postId',
  [ReactionTargetType.COMMENT]: 'commentId',
};

export interface ReactionSummary {
  total: number;
  byType: Record<ReactionType, number>;
  mine: ReactionType | null;
}

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionRepository: Repository<Reaction>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async set(
    userId: number,
    targetType: ReactionTargetType,
    targetId: number,
    type: ReactionType,
  ): Promise<Reaction> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const ownerId = await this.assertTargetAccessible(
      targetType,
      targetId,
      userId,
    );

    const targetColumn = TARGET_COLUMNS[targetType];
    const existingReactionObj = await this.reactionRepository.findOneBy({
      profileId: profileObj.id,
      [targetColumn]: targetId,
    } as FindOptionsWhere<Reaction>);

    if (existingReactionObj) {
      if (existingReactionObj.type !== type) {
        existingReactionObj.type = type;
        return await this.reactionRepository.save(existingReactionObj);
      }
      return existingReactionObj;
    }

    const createdReactionObj = await this.dataSource.transaction(
      async (manager) => {
        const reactionObj = await manager.save(
          manager.create(Reaction, {
            profileId: profileObj.id,
            type,
            [targetColumn]: targetId,
          } as DeepPartial<Reaction>),
        );
        if (targetType === ReactionTargetType.POST) {
          await manager.increment(Post, { id: targetId }, 'likes', 1);
        }
        return reactionObj;
      },
    );

    // Solo la primera reacción notifica, cambiar de tipo después no vuelve a avisar
    await this.eventEmitter.emitAsync(NotificationEvents.REACTION_CREATED, {
      actorId: profileObj.id,
      ownerId,
      targetType,
      targetId,
    } satisfies ReactionCreatedEvent);
    return createdReactionObj;
  }

  async remove(
    userId: number,
    targetType: ReactionTargetType,
    targetId: number,
  ): Promise<{ message: string }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const targetColumn = TARGET_COLUMNS[targetType];
    const reactionObj = await this.reactionRepository.findOneBy({
      profileId: profileObj.id,
      [targetColumn]: targetId,
    } as FindOptionsWhere<Reaction>);
    if (!reactionObj) {
      throw new NotFoundException('No has reaccionado a este recurso');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(Reaction, reactionObj);
      if (targetType === ReactionTargetType.POST) {
        await manager.decrement(Post, { id: targetId }, 'likes', 1);
      }
    });
    return { message: 'Reaction removed successfully' };
  }

  async summary(
    targetType: ReactionTargetType,
    targetId: number,
    userId: number | null,
  ): Promise<ReactionSummary> {
    await this.assertTargetAccessible(targetType, targetId, userId);
    const targetColumn = TARGET_COLUMNS[targetType];

    const rows = await this.reactionRepository
      .createQueryBuilder('reaction')
      .select('reaction.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where(`reaction.${targetColumn} = :targetId`, { targetId })
      .groupBy('reaction.type')
      .getRawMany<{ type: ReactionType; count: string }>();

    const byType: Record<ReactionType, number> = {
      [ReactionType.LIKE]: 0,
      [ReactionType.LOVE]: 0,
      [ReactionType.INSIGHTFUL]: 0,
    };
    for (const row of rows) {
      byType[row.type] = Number(row.count);
    }
    const total = Object.values(byType).reduce((sum, count) => sum + count, 0);

    let mine: ReactionType | null = null;
    const viewerProfileObj =
      userId === null
        ? null
        : await this.profilesService.findByUserIdOrNull(userId);
    if (viewerProfileObj) {
      const mineReactionObj = await this.reactionRepository.findOneBy({
        profileId: viewerProfileObj.id,
        [targetColumn]: targetId,
      } as FindOptionsWhere<Reaction>);
      mine = mineReactionObj?.type ?? null;
    }
    return { total, byType, mine };
  }

  private async assertTargetAccessible(
    targetType: ReactionTargetType,
    targetId: number,
    userId: number | null,
  ): Promise<number> {
    switch (targetType) {
      case ReactionTargetType.ARTICLE:
        return (await this.articlesService.findPublishedOne(targetId, userId))
          .authorId;
      case ReactionTargetType.POST:
        return (await this.postsService.findVisible(targetId, userId)).ownerId;
      case ReactionTargetType.COMMENT:
        return (await this.commentsService.findAccessible(targetId, userId))
          .authorId;
    }
  }
}