import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { ArticleNotFoundException } from '../../common/exceptions/http/article-not-found.exception';
import { PostNotFoundException } from '../../common/exceptions/http/post-not-found.exception';
import { MembershipsService } from '../../communities/memberships/memberships.service';
import { FollowsService } from '../../profiles/follows/follows.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { PostType, PostVisibility } from '../enums/post.enums';
import { Post } from './entities/post.entity';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;
  const eventEmitter = { emitAsync: jest.fn() };
  const postRepository = { findOne: jest.fn(), findOneBy: jest.fn() };
  const profilesService = {
    findByUserId: jest.fn(),
    findByUserIdOrNull: jest.fn(),
  };
  const articlesService = { findPublishedOne: jest.fn() };
  const followsService = { isFollowing: jest.fn() };
  const membershipsService = {
    assertActiveMember: jest.fn(),
    isActiveMember: jest.fn(),
  };
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
    remove: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  const buildPost = (overrides: Partial<Post> = {}) =>
    ({
      id: 10,
      ownerId: 2,
      postType: PostType.ORIGINAL,
      visibility: PostVisibility.PUBLIC,
      parentPostId: null,
      ...overrides,
    }) as Post;

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((data: object) =>
      Promise.resolve({ id: 99, ...data }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getRepositoryToken(Post), useValue: postRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
        { provide: FollowsService, useValue: followsService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: DataSource, useValue: dataSource },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create: forma de cada tipo', () => {
    it.each([
      ['un original sin contenido', { postType: PostType.ORIGINAL }],
      ['un original con parentPostId', { content: 'x', parentPostId: 10 }],
      ['un reply sin parentPostId', { postType: PostType.REPLY, content: 'x' }],
      [
        'un reply sin contenido',
        { postType: PostType.REPLY, parentPostId: 10 },
      ],
      [
        'un quote sin contenido',
        { postType: PostType.QUOTE, parentPostId: 10 },
      ],
      [
        'un repost con contenido',
        { postType: PostType.REPOST, parentPostId: 10, content: 'x' },
      ],
      ['un contenido solo de espacios', { content: '   ' }],
    ])('rechaza %s', async (_caso, createPostDto) => {
      await expect(service.create(9, createPostDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('crea un post original sin tocar contadores', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ id: 99 }));

      await service.create(9, { content: ' Hola ' });

      expect(manager.create).toHaveBeenCalledWith(
        Post,
        expect.objectContaining({
          ownerId: 1,
          content: 'Hola',
          postType: PostType.ORIGINAL,
          visibility: PostVisibility.PUBLIC,
        }),
      );
      expect(manager.increment).not.toHaveBeenCalled();
    });

    it('un reply suma al commentCount del padre', async () => {
      postRepository.findOne
        .mockResolvedValueOnce(buildPost())
        .mockResolvedValueOnce(buildPost({ id: 99 }));

      await service.create(9, {
        postType: PostType.REPLY,
        parentPostId: 10,
        content: 'Respuesta',
      });

      expect(manager.increment).toHaveBeenCalledWith(
        Post,
        { id: 10 },
        'commentCount',
        1,
      );
    });

    it('un repost y una cita suman al repostCount del padre', async () => {
      postRepository.findOne.mockResolvedValue(buildPost());
      postRepository.findOneBy.mockResolvedValue(null);

      await service.create(9, {
        postType: PostType.REPOST,
        parentPostId: 10,
      });
      await service.create(9, {
        postType: PostType.QUOTE,
        parentPostId: 10,
        content: 'Cita',
      });

      expect(manager.increment).toHaveBeenNthCalledWith(
        1,
        Post,
        { id: 10 },
        'repostCount',
        1,
      );
      expect(manager.increment).toHaveBeenNthCalledWith(
        2,
        Post,
        { id: 10 },
        'repostCount',
        1,
      );
    });

    it('no permite republicar un repost', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ postType: PostType.REPOST }),
      );
      await expect(
        service.create(9, { postType: PostType.REPOST, parentPostId: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('no permite republicar un post que no es público si no es propio', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ visibility: PostVisibility.FOLLOWERS }),
      );
      followsService.isFollowing.mockResolvedValue(true);

      await expect(
        service.create(9, { postType: PostType.REPOST, parentPostId: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lanza ConflictException si ya republicó ese post', async () => {
      postRepository.findOne.mockResolvedValue(buildPost());
      postRepository.findOneBy.mockResolvedValue({ id: 50 });
      await expect(
        service.create(9, { postType: PostType.REPOST, parentPostId: 10 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('valida que el artículo compartido esté publicado', async () => {
      articlesService.findPublishedOne.mockRejectedValueOnce(
        new ArticleNotFoundException(5),
      );
      await expect(
        service.create(9, { content: 'x', articleId: 5 }),
      ).rejects.toBeInstanceOf(ArticleNotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('create: notificación', () => {
    it('un post original sin comunidad emite el evento sin destinatarios', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ id: 99 }));

      await service.create(9, { content: 'Hola' });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('post.created', {
        postId: 99,
        actorId: 1,
        postType: PostType.ORIGINAL,
        communityId: null,
        parentOwnerId: null,
      });
    });

    it('una respuesta incluye al propietario del post respondido', async () => {
      postRepository.findOne
        .mockResolvedValueOnce(buildPost({ ownerId: 2 }))
        .mockResolvedValueOnce(buildPost({ id: 99 }));

      await service.create(9, {
        postType: PostType.REPLY,
        parentPostId: 10,
        content: 'Respuesta',
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'post.created',
        expect.objectContaining({
          postType: PostType.REPLY,
          parentOwnerId: 2,
        }),
      );
    });

    it('un post de comunidad incluye la comunidad', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ id: 99 }));

      await service.create(9, { content: 'Hola', communityId: 4 });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'post.created',
        expect.objectContaining({ communityId: 4 }),
      );
    });

    it('emite el evento después de guardar el post', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ id: 99 }));
      await service.create(9, { content: 'Hola' });
      expect(manager.save.mock.invocationCallOrder[0]).toBeLessThan(
        eventEmitter.emitAsync.mock.invocationCallOrder[0],
      );
    });

    it('un post inválido no emite nada', async () => {
      await expect(service.create(9, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('create: comunidad', () => {
    beforeEach(() => {
      postRepository.findOne.mockResolvedValue(buildPost({ id: 99 }));
    });

    it('communityId implica visibilidad COMMUNITY y exige ser miembro activo', async () => {
      await service.create(9, { content: 'Hola', communityId: 4 });

      expect(membershipsService.assertActiveMember).toHaveBeenCalledWith(4, 1);
      expect(manager.create).toHaveBeenCalledWith(
        Post,
        expect.objectContaining({
          visibility: PostVisibility.COMMUNITY,
          communityId: 4,
        }),
      );
    });

    it('no publica si el usuario no es miembro de la comunidad', async () => {
      membershipsService.assertActiveMember.mockRejectedValueOnce(
        new ForbiddenException(),
      );
      await expect(
        service.create(9, { content: 'Hola', communityId: 4 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rechaza la visibilidad COMMUNITY sin communityId', async () => {
      await expect(
        service.create(9, {
          content: 'Hola',
          visibility: PostVisibility.COMMUNITY,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un communityId con otra visibilidad', async () => {
      await expect(
        service.create(9, {
          content: 'Hola',
          communityId: 4,
          visibility: PostVisibility.PUBLIC,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('una respuesta a un post de comunidad hereda la comunidad del padre', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({
          visibility: PostVisibility.COMMUNITY,
          communityId: 4,
        }),
      );
      membershipsService.isActiveMember.mockResolvedValue(true);

      await service.create(9, {
        postType: PostType.REPLY,
        parentPostId: 10,
        content: 'Respuesta interna',
      });

      expect(manager.create).toHaveBeenCalledWith(
        Post,
        expect.objectContaining({
          visibility: PostVisibility.COMMUNITY,
          communityId: 4,
        }),
      );
      expect(membershipsService.assertActiveMember).toHaveBeenCalledWith(4, 1);
    });
  });

  describe('findVisible: comunidad', () => {
    const buildCommunityPost = () =>
      buildPost({ visibility: PostVisibility.COMMUNITY, communityId: 4 });

    it('un post de comunidad se oculta a anónimos', async () => {
      postRepository.findOne.mockResolvedValue(buildCommunityPost());
      await expect(service.findVisible(10, null)).rejects.toBeInstanceOf(
        PostNotFoundException,
      );
    });

    it('un post de comunidad se oculta a quien no es miembro, aunque siga al autor', async () => {
      postRepository.findOne.mockResolvedValue(buildCommunityPost());
      membershipsService.isActiveMember.mockResolvedValue(false);
      followsService.isFollowing.mockResolvedValue(true);

      await expect(service.findVisible(10, 9)).rejects.toBeInstanceOf(
        PostNotFoundException,
      );
      expect(membershipsService.isActiveMember).toHaveBeenCalledWith(4, 1);
    });

    it('un post de comunidad lo ve un miembro activo', async () => {
      postRepository.findOne.mockResolvedValue(buildCommunityPost());
      membershipsService.isActiveMember.mockResolvedValue(true);
      await expect(service.findVisible(10, 9)).resolves.toMatchObject({
        id: 10,
      });
    });
  });

  describe('findVisible', () => {
    it('un post público lo ve cualquiera, incluso anónimos', async () => {
      postRepository.findOne.mockResolvedValue(buildPost());
      await expect(service.findVisible(10, null)).resolves.toMatchObject({
        id: 10,
      });
    });

    it('un post de seguidores se oculta a anónimos', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ visibility: PostVisibility.FOLLOWERS }),
      );
      await expect(service.findVisible(10, null)).rejects.toBeInstanceOf(
        PostNotFoundException,
      );
    });

    it('un post de seguidores se oculta a quien no sigue al autor', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ visibility: PostVisibility.FOLLOWERS }),
      );
      followsService.isFollowing.mockResolvedValue(false);
      await expect(service.findVisible(10, 9)).rejects.toBeInstanceOf(
        PostNotFoundException,
      );
    });

    it('un post de seguidores lo ve un seguidor', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ visibility: PostVisibility.FOLLOWERS }),
      );
      followsService.isFollowing.mockResolvedValue(true);
      await expect(service.findVisible(10, 9)).resolves.toMatchObject({
        id: 10,
      });
      expect(followsService.isFollowing).toHaveBeenCalledWith(1, 2);
    });

    it('un post de seguidores lo ve su propio autor sin consultar follows', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ visibility: PostVisibility.FOLLOWERS, ownerId: 1 }),
      );
      await expect(service.findVisible(10, 9)).resolves.toMatchObject({
        id: 10,
      });
      expect(followsService.isFollowing).not.toHaveBeenCalled();
    });

    it('lanza PostNotFoundException si no existe', async () => {
      postRepository.findOne.mockResolvedValue(null);
      await expect(service.findVisible(10, null)).rejects.toBeInstanceOf(
        PostNotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('resta del contador del padre al borrar una respuesta', async () => {
      const replyObj = buildPost({
        ownerId: 1,
        postType: PostType.REPLY,
        parentPostId: 5,
      });
      postRepository.findOne.mockResolvedValue(replyObj);

      await service.remove(9, 10);

      expect(manager.decrement).toHaveBeenCalledWith(
        Post,
        { id: 5 },
        'commentCount',
        1,
      );
      expect(manager.remove).toHaveBeenCalledWith(Post, replyObj);
    });

    it('resta de repostCount al borrar un repost', async () => {
      postRepository.findOne.mockResolvedValue(
        buildPost({ ownerId: 1, postType: PostType.REPOST, parentPostId: 5 }),
      );
      await service.remove(9, 10);
      expect(manager.decrement).toHaveBeenCalledWith(
        Post,
        { id: 5 },
        'repostCount',
        1,
      );
    });

    it('no toca contadores al borrar un post sin padre', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ ownerId: 1 }));
      await service.remove(9, 10);
      expect(manager.decrement).not.toHaveBeenCalled();
    });

    it('no permite borrar el post de otro perfil', async () => {
      postRepository.findOne.mockResolvedValue(buildPost({ ownerId: 2 }));
      await expect(service.remove(9, 10)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(manager.remove).not.toHaveBeenCalled();
    });
  });
});