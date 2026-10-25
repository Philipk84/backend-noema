import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { PostNotFoundException } from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { CommentsService } from '../comments/comments.service';
import { ReactionTargetType, ReactionType } from '../enums/reaction.enums';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { Reaction } from './entities/reaction.entity';
import { ReactionsService } from './reactions.service';

describe('ReactionsService', () => {
  let service: ReactionsService;
  const eventEmitter = { emitAsync: jest.fn() };
  const reactionRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const profilesService = {
    findByUserId: jest.fn(),
    findByUserIdOrNull: jest.fn(),
  };
  const articlesService = { findPublishedOne: jest.fn() };
  const postsService = { findVisible: jest.fn() };
  const commentsService = { findAccessible: jest.fn() };
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    // Reaccionar avisa al dueño del recurso, así que cada comprobación debe devolverlo
    articlesService.findPublishedOne.mockResolvedValue({ id: 5, authorId: 2 });
    postsService.findVisible.mockResolvedValue({ id: 7, ownerId: 2 });
    commentsService.findAccessible.mockResolvedValue({ id: 6, authorId: 2 });
    profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((data: object) => Promise.resolve(data));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        {
          provide: getRepositoryToken(Reaction),
          useValue: reactionRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
        { provide: PostsService, useValue: postsService },
        { provide: CommentsService, useValue: commentsService },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<ReactionsService>(ReactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('set', () => {
    it('una reacción nueva a un post guarda el recurso en postId y suma a likes', async () => {
      reactionRepository.findOneBy.mockResolvedValue(null);

      await service.set(9, ReactionTargetType.POST, 7, ReactionType.LIKE);

      expect(postsService.findVisible).toHaveBeenCalledWith(7, 9);
      expect(manager.create).toHaveBeenCalledWith(Reaction, {
        profileId: 1,
        type: ReactionType.LIKE,
        postId: 7,
      });
      expect(manager.increment).toHaveBeenCalledWith(
        Post,
        { id: 7 },
        'likes',
        1,
      );
    });

    it('una reacción nueva a un artículo o comentario no toca likes', async () => {
      reactionRepository.findOneBy.mockResolvedValue(null);

      await service.set(9, ReactionTargetType.ARTICLE, 5, ReactionType.LOVE);
      await service.set(9, ReactionTargetType.COMMENT, 6, ReactionType.LIKE);

      expect(articlesService.findPublishedOne).toHaveBeenCalledWith(5, 9);
      expect(commentsService.findAccessible).toHaveBeenCalledWith(6, 9);
      expect(manager.create).toHaveBeenNthCalledWith(
        1,
        Reaction,
        expect.objectContaining({ articleId: 5 }),
      );
      expect(manager.create).toHaveBeenNthCalledWith(
        2,
        Reaction,
        expect.objectContaining({ commentId: 6 }),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('cambiar el tipo actualiza la reacción sin tocar likes', async () => {
      const existingReactionObj = { id: 1, type: ReactionType.LIKE };
      reactionRepository.findOneBy.mockResolvedValue(existingReactionObj);

      await service.set(9, ReactionTargetType.POST, 7, ReactionType.LOVE);

      expect(existingReactionObj.type).toBe(ReactionType.LOVE);
      expect(reactionRepository.save).toHaveBeenCalledWith(existingReactionObj);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('repetir el mismo tipo no escribe nada', async () => {
      reactionRepository.findOneBy.mockResolvedValue({
        id: 1,
        type: ReactionType.LIKE,
      });

      await service.set(9, ReactionTargetType.POST, 7, ReactionType.LIKE);

      expect(reactionRepository.save).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('no reacciona a un post que el usuario no puede ver', async () => {
      postsService.findVisible.mockRejectedValueOnce(
        new PostNotFoundException(7),
      );
      await expect(
        service.set(9, ReactionTargetType.POST, 7, ReactionType.LIKE),
      ).rejects.toBeInstanceOf(PostNotFoundException);
      expect(reactionRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('set: notificación', () => {
    beforeEach(() => {
      reactionRepository.findOneBy.mockResolvedValue(null);
    });

    it.each([
      [
        ReactionTargetType.ARTICLE,
        () =>
          articlesService.findPublishedOne.mockResolvedValue({ authorId: 2 }),
      ],
      [
        ReactionTargetType.POST,
        () => postsService.findVisible.mockResolvedValue({ ownerId: 2 }),
      ],
      [
        ReactionTargetType.COMMENT,
        () => commentsService.findAccessible.mockResolvedValue({ authorId: 2 }),
      ],
    ])(
      'una reacción nueva a %s avisa al dueño del recurso',
      async (targetType, arrange) => {
        arrange();

        await service.set(9, targetType, 7, ReactionType.LIKE);

        expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
          'reaction.created',
          { actorId: 1, ownerId: 2, targetType, targetId: 7 },
        );
      },
    );

    it('cambiar el tipo de una reacción existente no vuelve a avisar', async () => {
      articlesService.findPublishedOne.mockResolvedValue({ authorId: 2 });
      reactionRepository.findOneBy.mockResolvedValue({
        id: 1,
        type: ReactionType.LIKE,
      });

      await service.set(9, ReactionTargetType.ARTICLE, 7, ReactionType.LOVE);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('repetir la misma reacción tampoco avisa', async () => {
      articlesService.findPublishedOne.mockResolvedValue({ authorId: 2 });
      reactionRepository.findOneBy.mockResolvedValue({
        id: 1,
        type: ReactionType.LIKE,
      });

      await service.set(9, ReactionTargetType.ARTICLE, 7, ReactionType.LIKE);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('si el recurso no es accesible no guarda ni avisa', async () => {
      postsService.findVisible.mockRejectedValueOnce(
        new PostNotFoundException(7),
      );
      await expect(
        service.set(9, ReactionTargetType.POST, 7, ReactionType.LIKE),
      ).rejects.toBeInstanceOf(PostNotFoundException);
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('quitar una reacción no genera eventos', async () => {
      reactionRepository.findOneBy.mockResolvedValue({ id: 1 });
      await service.remove(9, ReactionTargetType.ARTICLE, 5);
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('quitar la reacción a un post resta de likes', async () => {
      const reactionObj = { id: 1 };
      reactionRepository.findOneBy.mockResolvedValue(reactionObj);

      await service.remove(9, ReactionTargetType.POST, 7);

      expect(manager.remove).toHaveBeenCalledWith(Reaction, reactionObj);
      expect(manager.decrement).toHaveBeenCalledWith(
        Post,
        { id: 7 },
        'likes',
        1,
      );
    });

    it('quitar la reacción a un artículo no toca likes', async () => {
      reactionRepository.findOneBy.mockResolvedValue({ id: 1 });
      await service.remove(9, ReactionTargetType.ARTICLE, 5);
      expect(manager.decrement).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no había reaccionado', async () => {
      reactionRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.remove(9, ReactionTargetType.POST, 7),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('summary', () => {
    const mockCounts = (rows: { type: ReactionType; count: string }[]) => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      reactionRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      return queryBuilder;
    };

    it('devuelve el conteo por tipo con ceros para los tipos sin reacciones', async () => {
      const queryBuilder = mockCounts([
        { type: ReactionType.LOVE, count: '2' },
        { type: ReactionType.INSIGHTFUL, count: '1' },
      ]);
      reactionRepository.findOneBy.mockResolvedValue({
        type: ReactionType.LOVE,
      });

      const result = await service.summary(ReactionTargetType.POST, 7, 9);

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'reaction.postId = :targetId',
        { targetId: 7 },
      );
      expect(result).toEqual({
        total: 3,
        byType: { LIKE: 0, LOVE: 2, INSIGHTFUL: 1 },
        mine: ReactionType.LOVE,
      });
    });

    it('un anónimo no tiene reacción propia', async () => {
      mockCounts([]);
      const result = await service.summary(ReactionTargetType.POST, 7, null);
      expect(result).toEqual({
        total: 0,
        byType: { LIKE: 0, LOVE: 0, INSIGHTFUL: 0 },
        mine: null,
      });
      expect(reactionRepository.findOneBy).not.toHaveBeenCalled();
    });
  });
});