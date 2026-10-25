import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  CommentNotFoundException,
  PostNotFoundException,
} from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { Post } from '../posts/entities/post.entity';
import { PostsService } from '../posts/posts.service';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

describe('CommentsService', () => {
  let service: CommentsService;
  const eventEmitter = { emitAsync: jest.fn() };
  const commentRepository = {
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const articlesService = { findPublishedOne: jest.fn() };
  const postsService = { findVisible: jest.fn() };
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    remove: jest.fn(),
    query: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    // El comentario avisa al dueño del recurso comentado, así que ambos deben existir
    articlesService.findPublishedOne.mockResolvedValue({ id: 5, authorId: 2 });
    postsService.findVisible.mockResolvedValue({ id: 7, ownerId: 3 });
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((data: object) =>
      Promise.resolve({ id: 99, ...data }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
        { provide: PostsService, useValue: postsService },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create: destino', () => {
    it.each([
      ['no indica destino', { content: 'x' }],
      ['indica dos destinos', { content: 'x', articleId: 1, postId: 2 }],
    ])('rechaza el comentario que %s', async (_caso, createCommentDto) => {
      await expect(service.create(9, createCommentDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('comenta un artículo publicado sin tocar contadores', async () => {
      await service.create(9, { content: 'x', articleId: 5 });

      expect(articlesService.findPublishedOne).toHaveBeenCalledWith(5, 9);
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('comenta un post visible y suma a su commentCount', async () => {
      await service.create(9, { content: 'x', postId: 7 });

      expect(postsService.findVisible).toHaveBeenCalledWith(7, 9);
      expect(manager.increment).toHaveBeenCalledWith(
        Post,
        { id: 7 },
        'commentCount',
        1,
      );
    });

    it('no comenta un post que el usuario no puede ver', async () => {
      postsService.findVisible.mockRejectedValueOnce(
        new PostNotFoundException(7),
      );
      await expect(
        service.create(9, { content: 'x', postId: 7 }),
      ).rejects.toBeInstanceOf(PostNotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('create: notificación', () => {
    it('al comentar un artículo avisa a su autor', async () => {
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 2,
      });

      await service.create(9, { content: 'x', articleId: 5 });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('comment.created', {
        commentId: 99,
        actorId: 1,
        ownerId: 2,
        parentAuthorId: null,
      });
    });

    it('al comentar un post avisa a su propietario', async () => {
      postsService.findVisible.mockResolvedValue({ id: 7, ownerId: 3 });

      await service.create(9, { content: 'x', postId: 7 });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'comment.created',
        expect.objectContaining({ ownerId: 3, parentAuthorId: null }),
      );
    });

    it('al responder a un comentario avisa también a su autor', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        authorId: 4,
        articleId: 5,
        postId: null,
      });
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 2,
      });

      await service.create(9, { content: 'x', parentCommentId: 3 });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'comment.created',
        expect.objectContaining({ ownerId: 2, parentAuthorId: 4 }),
      );
    });

    it('emite el evento después de guardar el comentario', async () => {
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 2,
      });
      await service.create(9, { content: 'x', articleId: 5 });
      expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventEmitter.emitAsync.mock.invocationCallOrder[0],
      );
    });

    it('no emite nada si el comentario no se puede crear', async () => {
      await expect(service.create(9, { content: 'x' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('create: respuestas', () => {
    it('hereda el destino del comentario padre', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        articleId: null,
        postId: 7,
      });

      await service.create(9, { content: 'x', parentCommentId: 3 });

      expect(manager.create).toHaveBeenCalledWith(
        Comment,
        expect.objectContaining({
          articleId: null,
          postId: 7,
          parentCommentId: 3,
        }),
      );
    });

    it('rechaza un destino distinto al del padre', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        articleId: null,
        postId: 7,
      });
      await expect(
        service.create(9, { content: 'x', parentCommentId: 3, articleId: 5 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('lanza CommentNotFoundException si el padre no existe', async () => {
      commentRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.create(9, { content: 'x', parentCommentId: 3 }),
      ).rejects.toBeInstanceOf(CommentNotFoundException);
    });
  });

  describe('remove', () => {
    it('resta del post el comentario y todas sus respuestas en cascada', async () => {
      const commentObj = { id: 3, authorId: 1, postId: 7, articleId: null };
      commentRepository.findOneBy.mockResolvedValue(commentObj);
      manager.query.mockResolvedValue([{ count: 3 }]);

      await service.remove(9, 3);

      expect(manager.decrement).toHaveBeenCalledWith(
        Post,
        { id: 7 },
        'commentCount',
        3,
      );
      expect(manager.remove).toHaveBeenCalledWith(Comment, commentObj);
    });

    it('un comentario de artículo no toca contadores', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        authorId: 1,
        postId: null,
        articleId: 5,
      });

      await service.remove(9, 3);

      expect(manager.query).not.toHaveBeenCalled();
      expect(manager.decrement).not.toHaveBeenCalled();
    });

    it('no permite borrar el comentario de otro perfil', async () => {
      commentRepository.findOneBy.mockResolvedValue({ id: 3, authorId: 2 });
      await expect(service.remove(9, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(manager.remove).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('no permite editar el comentario de otro perfil', async () => {
      commentRepository.findOneBy.mockResolvedValue({ id: 3, authorId: 2 });
      await expect(
        service.update(9, 3, { content: 'nuevo' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(commentRepository.save).not.toHaveBeenCalled();
    });

    it('edita el texto del propio comentario', async () => {
      commentRepository.findOneBy.mockResolvedValue({ id: 3, authorId: 1 });
      await service.update(9, 3, { content: 'nuevo' });
      expect(commentRepository.merge).toHaveBeenCalledWith(
        { id: 3, authorId: 1 },
        { content: 'nuevo' },
      );
      expect(commentRepository.save).toHaveBeenCalled();
    });
  });

  describe('findAccessible', () => {
    it('comprueba el artículo del comentario', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        articleId: 5,
        postId: null,
      });
      await service.findAccessible(3, null);
      expect(articlesService.findPublishedOne).toHaveBeenCalledWith(5, null);
    });

    it('comprueba la visibilidad del post del comentario', async () => {
      commentRepository.findOneBy.mockResolvedValue({
        id: 3,
        articleId: null,
        postId: 7,
      });
      await service.findAccessible(3, 9);
      expect(postsService.findVisible).toHaveBeenCalledWith(7, 9);
    });
  });
});