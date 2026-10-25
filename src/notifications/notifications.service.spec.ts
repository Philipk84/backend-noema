import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationNotFoundException } from '../common/exceptions';
import { MembershipsService } from '../communities/memberships/memberships.service';
import { ProfilesService } from '../profiles/profiles.service';
import { Notification } from './entities/notification.entity';
import {
  NotificationReferenceType,
  NotificationType,
} from './enums/notification.enums';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  const notificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const membershipsService = { findActiveMemberProfileIds: jest.fn() };

  const savedDrafts = () =>
    notificationRepository.save.mock.calls[0][0] as Record<string, unknown>[];

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    notificationRepository.create.mockImplementation((data: object) => ({
      ...data,
    }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: MembershipsService, useValue: membershipsService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onProfileFollowed', () => {
    it('avisa al seguido y apunta al perfil del seguidor', async () => {
      await service.onProfileFollowed({ followerId: 5, followedId: 2 });
      expect(savedDrafts()).toEqual([
        {
          recipientId: 2,
          actorId: 5,
          type: NotificationType.FOLLOW,
          referenceType: NotificationReferenceType.PROFILE,
          referenceId: 5,
        },
      ]);
    });
  });

  describe('onCommentCreated', () => {
    it('avisa al dueño del recurso y apunta al comentario', async () => {
      await service.onCommentCreated({
        commentId: 30,
        actorId: 5,
        ownerId: 2,
        parentAuthorId: null,
      });
      expect(savedDrafts()).toEqual([
        {
          recipientId: 2,
          actorId: 5,
          type: NotificationType.COMMENT,
          referenceType: NotificationReferenceType.COMMENT,
          referenceId: 30,
        },
      ]);
    });

    it('avisa también al autor del comentario respondido', async () => {
      await service.onCommentCreated({
        commentId: 30,
        actorId: 5,
        ownerId: 2,
        parentAuthorId: 4,
      });
      expect(savedDrafts().map((draft) => draft.recipientId)).toEqual([2, 4]);
    });

    it('si el dueño y el autor respondido son la misma persona, avisa una sola vez', async () => {
      await service.onCommentCreated({
        commentId: 30,
        actorId: 5,
        ownerId: 2,
        parentAuthorId: 2,
      });
      expect(savedDrafts()).toHaveLength(1);
    });

    it('quien comenta no se avisa a sí mismo', async () => {
      await service.onCommentCreated({
        commentId: 30,
        actorId: 2,
        ownerId: 2,
        parentAuthorId: 4,
      });
      expect(savedDrafts().map((draft) => draft.recipientId)).toEqual([4]);
    });

    it('si el actor es el único destinatario no guarda nada', async () => {
      await service.onCommentCreated({
        commentId: 30,
        actorId: 2,
        ownerId: 2,
        parentAuthorId: null,
      });
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('onReactionCreated', () => {
    it.each([
      ['article', NotificationReferenceType.ARTICLE],
      ['post', NotificationReferenceType.POST],
      ['comment', NotificationReferenceType.COMMENT],
    ] as const)(
      'una reacción a un %s apunta a ese recurso',
      async (targetType, referenceType) => {
        await service.onReactionCreated({
          actorId: 5,
          ownerId: 2,
          targetType,
          targetId: 7,
        });
        expect(savedDrafts()).toEqual([
          {
            recipientId: 2,
            actorId: 5,
            type: NotificationType.REACTION,
            referenceType,
            referenceId: 7,
          },
        ]);
      },
    );

    it('reaccionar a lo propio no notifica', async () => {
      await service.onReactionCreated({
        actorId: 2,
        ownerId: 2,
        targetType: 'article',
        targetId: 7,
      });
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('onPostCreated', () => {
    const baseEvent = {
      postId: 40,
      actorId: 5,
      postType: 'ORIGINAL' as const,
      communityId: null,
      parentOwnerId: null,
    };

    it('un post original sin comunidad no genera avisos', async () => {
      await service.onPostCreated(baseEvent);
      expect(notificationRepository.save).not.toHaveBeenCalled();
      expect(
        membershipsService.findActiveMemberProfileIds,
      ).not.toHaveBeenCalled();
    });

    it('una respuesta avisa al propietario del post como un COMMENT', async () => {
      await service.onPostCreated({
        ...baseEvent,
        postType: 'REPLY',
        parentOwnerId: 2,
      });
      expect(savedDrafts()).toEqual([
        {
          recipientId: 2,
          actorId: 5,
          type: NotificationType.COMMENT,
          referenceType: NotificationReferenceType.POST,
          referenceId: 40,
        },
      ]);
    });

    it('un post de comunidad avisa a todos los miembros activos menos al autor', async () => {
      membershipsService.findActiveMemberProfileIds.mockResolvedValue([
        5, 6, 7,
      ]);

      await service.onPostCreated({ ...baseEvent, communityId: 3 });

      expect(
        membershipsService.findActiveMemberProfileIds,
      ).toHaveBeenCalledWith(3);
      const drafts = savedDrafts();
      expect(drafts.map((draft) => draft.recipientId)).toEqual([6, 7]);
      expect(drafts[0]).toMatchObject({
        type: NotificationType.POST_IN_COMMUNITY,
        referenceType: NotificationReferenceType.POST,
        referenceId: 40,
      });
    });

    it('guarda todos los avisos en una sola inserción', async () => {
      membershipsService.findActiveMemberProfileIds.mockResolvedValue([
        6, 7, 8,
      ]);
      await service.onPostCreated({ ...baseEvent, communityId: 3 });
      expect(notificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it('una respuesta dentro de la comunidad no se difunde a los miembros', async () => {
      await service.onPostCreated({
        ...baseEvent,
        postType: 'REPLY',
        communityId: 3,
        parentOwnerId: 2,
      });
      expect(
        membershipsService.findActiveMemberProfileIds,
      ).not.toHaveBeenCalled();
      expect(savedDrafts().map((draft) => draft.recipientId)).toEqual([2]);
    });

    it('una comunidad sin otros miembros no guarda nada', async () => {
      membershipsService.findActiveMemberProfileIds.mockResolvedValue([5]);
      await service.onPostCreated({ ...baseEvent, communityId: 3 });
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('membresías', () => {
    it('la solicitud avisa al propietario y apunta a la comunidad', async () => {
      await service.onMembershipRequested({
        communityId: 3,
        actorId: 5,
        ownerId: 2,
      });
      expect(savedDrafts()).toEqual([
        {
          recipientId: 2,
          actorId: 5,
          type: NotificationType.MEMBERSHIP,
          referenceType: NotificationReferenceType.COMMUNITY,
          referenceId: 3,
        },
      ]);
    });

    it('la aprobación avisa al solicitante, con quien aprobó como actor', async () => {
      await service.onMembershipApproved({
        communityId: 3,
        actorId: 2,
        recipientId: 5,
      });
      expect(savedDrafts()).toEqual([
        {
          recipientId: 5,
          actorId: 2,
          type: NotificationType.MEMBERSHIP,
          referenceType: NotificationReferenceType.COMMUNITY,
          referenceId: 3,
        },
      ]);
    });
  });

  describe('findMine', () => {
    it('lista solo las del perfil, de la más reciente a la más antigua', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findMine(9, { page: 2, limit: 10 });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { recipientId: 1 },
        relations: { actor: true },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: 10,
        take: 10,
      });
    });

    it('unread=true filtra las no leídas y type filtra por tipo', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findMine(9, {
        page: 1,
        limit: 20,
        unread: true,
        type: NotificationType.FOLLOW,
      });

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipientId: 1,
            isRead: false,
            type: NotificationType.FOLLOW,
          },
        }),
      );
    });

    it('unread=false no filtra', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findMine(9, { page: 1, limit: 20, unread: false });
      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recipientId: 1 } }),
      );
    });
  });

  describe('countUnread', () => {
    it('cuenta solo las no leídas del perfil', async () => {
      notificationRepository.countBy.mockResolvedValue(4);
      await expect(service.countUnread(9)).resolves.toEqual({ unread: 4 });
      expect(notificationRepository.countBy).toHaveBeenCalledWith({
        recipientId: 1,
        isRead: false,
      });
    });
  });

  describe('markAsRead', () => {
    it('marca como leída una no leída', async () => {
      notificationRepository.findOneBy.mockResolvedValue({
        id: 3,
        isRead: false,
      });
      const result = await service.markAsRead(9, 3);
      expect(result.isRead).toBe(true);
      expect(notificationRepository.save).toHaveBeenCalledTimes(1);
    });

    it('es idempotente: una ya leída no se vuelve a guardar', async () => {
      notificationRepository.findOneBy.mockResolvedValue({
        id: 3,
        isRead: true,
      });
      await service.markAsRead(9, 3);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('busca solo entre las notificaciones del perfil: una ajena responde 404', async () => {
      notificationRepository.findOneBy.mockResolvedValue(null);
      await expect(service.markAsRead(9, 3)).rejects.toBeInstanceOf(
        NotificationNotFoundException,
      );
      expect(notificationRepository.findOneBy).toHaveBeenCalledWith({
        id: 3,
        recipientId: 1,
      });
    });
  });

  describe('markAllAsRead', () => {
    it('actualiza solo las no leídas del perfil y devuelve cuántas fueron', async () => {
      notificationRepository.update.mockResolvedValue({ affected: 5 });
      await expect(service.markAllAsRead(9)).resolves.toEqual({ updated: 5 });
      expect(notificationRepository.update).toHaveBeenCalledWith(
        { recipientId: 1, isRead: false },
        { isRead: true },
      );
    });

    it('devuelve 0 si el driver no informa filas afectadas', async () => {
      notificationRepository.update.mockResolvedValue({});
      await expect(service.markAllAsRead(9)).resolves.toEqual({ updated: 0 });
    });
  });

  describe('remove', () => {
    it('borra una notificación propia', async () => {
      const notificationObj = { id: 3 };
      notificationRepository.findOneBy.mockResolvedValue(notificationObj);
      await service.remove(9, 3);
      expect(notificationRepository.remove).toHaveBeenCalledWith(
        notificationObj,
      );
    });

    it('una ajena responde 404 y no se borra', async () => {
      notificationRepository.findOneBy.mockResolvedValue(null);
      await expect(service.remove(9, 3)).rejects.toBeInstanceOf(
        NotificationNotFoundException,
      );
      expect(notificationRepository.remove).not.toHaveBeenCalled();
    });
  });
});