import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated } from '../common/dto/pagination-query.dto';
import { NotificationNotFoundException } from '../common/exceptions';
import { MembershipsService } from '../communities/memberships/memberships.service';
import { ProfilesService } from '../profiles/profiles.service';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { Notification } from './entities/notification.entity';
import {
  NotificationReferenceType,
  NotificationType,
} from './enums/notification.enums';
import { NotificationEvents } from './events/notification.events';
import type {
  CommentCreatedEvent,
  MembershipApprovedEvent,
  MembershipRequestedEvent,
  PostCreatedEvent,
  ProfileFollowedEvent,
  ReactionCreatedEvent,
} from './events/notification.events';

interface NotificationDraft {
  recipientId: number;
  actorId: number | null;
  type: NotificationType;
  referenceType: NotificationReferenceType;
  referenceId: number;
}

const REACTION_REFERENCE_TYPES: Record<
  ReactionCreatedEvent['targetType'],
  NotificationReferenceType
> = {
  article: NotificationReferenceType.ARTICLE,
  post: NotificationReferenceType.POST,
  comment: NotificationReferenceType.COMMENT,
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly profilesService: ProfilesService,
    private readonly membershipsService: MembershipsService,
  ) {}

  @OnEvent(NotificationEvents.PROFILE_FOLLOWED, { suppressErrors: true })
  async onProfileFollowed(event: ProfileFollowedEvent): Promise<void> {
    await this.createMany([
      {
        recipientId: event.followedId,
        actorId: event.followerId,
        type: NotificationType.FOLLOW,
        referenceType: NotificationReferenceType.PROFILE,
        referenceId: event.followerId,
      },
    ]);
  }

  @OnEvent(NotificationEvents.COMMENT_CREATED, { suppressErrors: true })
  async onCommentCreated(event: CommentCreatedEvent): Promise<void> {
    const recipientIds = new Set(
      [event.ownerId, event.parentAuthorId].filter(
        (recipientId): recipientId is number => recipientId !== null,
      ),
    );
    await this.createMany(
      [...recipientIds].map((recipientId) => ({
        recipientId,
        actorId: event.actorId,
        type: NotificationType.COMMENT,
        referenceType: NotificationReferenceType.COMMENT,
        referenceId: event.commentId,
      })),
    );
  }

  @OnEvent(NotificationEvents.REACTION_CREATED, { suppressErrors: true })
  async onReactionCreated(event: ReactionCreatedEvent): Promise<void> {
    await this.createMany([
      {
        recipientId: event.ownerId,
        actorId: event.actorId,
        type: NotificationType.REACTION,
        referenceType: REACTION_REFERENCE_TYPES[event.targetType],
        referenceId: event.targetId,
      },
    ]);
  }

  @OnEvent(NotificationEvents.POST_CREATED, { suppressErrors: true })
  async onPostCreated(event: PostCreatedEvent): Promise<void> {
    const drafts: NotificationDraft[] = [];

    if (event.postType === 'REPLY' && event.parentOwnerId !== null) {
      // Responder a un post equivale a comentarlo
      drafts.push({
        recipientId: event.parentOwnerId,
        actorId: event.actorId,
        type: NotificationType.COMMENT,
        referenceType: NotificationReferenceType.POST,
        referenceId: event.postId,
      });
    }

    // Las respuestas dentro de una comunidad no se difunden a todos los miembros
    if (event.communityId !== null && event.postType !== 'REPLY') {
      const memberProfileIds =
        await this.membershipsService.findActiveMemberProfileIds(
          event.communityId,
        );
      for (const memberProfileId of memberProfileIds) {
        drafts.push({
          recipientId: memberProfileId,
          actorId: event.actorId,
          type: NotificationType.POST_IN_COMMUNITY,
          referenceType: NotificationReferenceType.POST,
          referenceId: event.postId,
        });
      }
    }
    await this.createMany(drafts);
  }

  @OnEvent(NotificationEvents.MEMBERSHIP_REQUESTED, { suppressErrors: true })
  async onMembershipRequested(event: MembershipRequestedEvent): Promise<void> {
    await this.createMany([
      {
        recipientId: event.ownerId,
        actorId: event.actorId,
        type: NotificationType.MEMBERSHIP,
        referenceType: NotificationReferenceType.COMMUNITY,
        referenceId: event.communityId,
      },
    ]);
  }

  @OnEvent(NotificationEvents.MEMBERSHIP_APPROVED, { suppressErrors: true })
  async onMembershipApproved(event: MembershipApprovedEvent): Promise<void> {
    await this.createMany([
      {
        recipientId: event.recipientId,
        actorId: event.actorId,
        type: NotificationType.MEMBERSHIP,
        referenceType: NotificationReferenceType.COMMUNITY,
        referenceId: event.communityId,
      },
    ]);
  }

  private async createMany(drafts: NotificationDraft[]): Promise<void> {
    const notificationObjs = drafts
      .filter((draft) => draft.recipientId !== draft.actorId)
      .map((draft) => this.notificationRepository.create(draft));
    if (notificationObjs.length > 0) {
      await this.notificationRepository.save(notificationObjs);
    }
  }

  // bandeja del usuario

  async findMine(
    userId: number,
    query: FindNotificationsQueryDto,
  ): Promise<Paginated<Notification>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.notificationRepository.findAndCount({
      where: {
        recipientId: profileObj.id,
        ...(query.unread && { isRead: false }),
        ...(query.type !== undefined && { type: query.type }),
      },
      relations: { actor: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  async countUnread(userId: number): Promise<{ unread: number }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const unread = await this.notificationRepository.countBy({
      recipientId: profileObj.id,
      isRead: false,
    });
    return { unread };
  }

  async markAsRead(userId: number, id: number): Promise<Notification> {
    const notificationObj = await this.findOwned(userId, id);
    if (!notificationObj.isRead) {
      notificationObj.isRead = true;
      await this.notificationRepository.save(notificationObj);
    }
    return notificationObj;
  }

  async markAllAsRead(userId: number): Promise<{ updated: number }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const result = await this.notificationRepository.update(
      { recipientId: profileObj.id, isRead: false },
      { isRead: true },
    );
    return { updated: result.affected ?? 0 };
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const notificationObj = await this.findOwned(userId, id);
    await this.notificationRepository.remove(notificationObj);
    return { message: `Notification with id #${id} deleted successfully` };
  }

  private async findOwned(userId: number, id: number): Promise<Notification> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const notificationObj = await this.notificationRepository.findOneBy({
      id,
      recipientId: profileObj.id,
    });
    if (!notificationObj) {
      throw new NotificationNotFoundException(id);
    }
    return notificationObj;
  }
}