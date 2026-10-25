import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticleNotFoundException } from '../common/exceptions/http/article-not-found.exception';
import { MembershipsService } from '../communities/memberships/memberships.service';
import { SubscriptionsService } from '../monetization/subscriptions/subscriptions.service';
import { ProfilesService } from '../profiles/profiles.service';
import { ArticlesService } from './articles.service';
import { CollectionsService } from './collections/collections.service';
import { Article } from './entities/article.entity';
import { ArticleStatus } from './enums/article-status.enum';

describe('ArticlesService', () => {
  let service: ArticlesService;
  const articleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  // findPublishedOne y findOwned usan un query builder para poder pedir content (select: false);
  // getOne devuelve lo que cada prueba configure en articleRepository.findOne
  const queryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(() => articleRepository.findOne() as Promise<unknown>),
  };
  const subscriptionsService = { hasAccessToAuthor: jest.fn() };
  const profilesService = {
    findByUserId: jest.fn(),
    findByUserIdOrNull: jest.fn(),
  };
  const collectionsService = { findOwned: jest.fn() };
  const membershipsService = {
    assertActiveMember: jest.fn(),
    isActiveMember: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
    articleRepository.save.mockImplementation((obj: object) => obj);
    articleRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: CollectionsService, useValue: collectionsService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('asigna como autor al perfil del usuario autenticado', async () => {
      articleRepository.create.mockImplementation((data: object) => data);

      await service.create(9, { title: 'Hola', content: 'Texto' });

      expect(articleRepository.create).toHaveBeenCalledWith({
        title: 'Hola',
        content: 'Texto',
        authorId: 1,
      });
      expect(collectionsService.findOwned).not.toHaveBeenCalled();
    });

    it('valida que la colección sea del autor', async () => {
      articleRepository.create.mockImplementation((data: object) => data);
      collectionsService.findOwned.mockRejectedValueOnce(
        new ForbiddenException('otra colección'),
      );

      await expect(
        service.create(9, { title: 'Hola', content: 'Texto', collectionId: 5 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(articleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findPublishedOne', () => {
    it('lanza ArticleNotFoundException si no está publicado', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      await expect(service.findPublishedOne(3, null)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
      // Solo busca artículos publicados y pide content, que no se carga por defecto
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'article.status = :status',
        { status: ArticleStatus.PUBLISHED },
      );
      expect(queryBuilder.addSelect).toHaveBeenCalledWith('article.content');
    });
  });

  describe('findPublishedOne: artículos premium', () => {
    const FULL_CONTENT = 'palabra '.repeat(100).trim();
    const buildPremiumArticle = () => ({
      id: 3,
      authorId: 2,
      communityId: null,
      isPremium: true,
      content: FULL_CONTENT,
    });

    it('un artículo gratuito nunca queda bloqueado', async () => {
      articleRepository.findOne.mockResolvedValue({
        id: 3,
        authorId: 2,
        communityId: null,
        isPremium: false,
        content: FULL_CONTENT,
      });
      const result = await service.findPublishedOne(3, null);
      expect(result.locked).toBe(false);
      expect(result.content).toBe(FULL_CONTENT);
      expect(subscriptionsService.hasAccessToAuthor).not.toHaveBeenCalled();
    });

    it('un anónimo recibe solo un adelanto, cortado en una palabra completa', async () => {
      articleRepository.findOne.mockResolvedValue(buildPremiumArticle());

      const result = await service.findPublishedOne(3, null);

      expect(result.locked).toBe(true);
      expect(result.content.length).toBeLessThan(FULL_CONTENT.length);
      expect(result.content.endsWith('…')).toBe(true);
      expect(FULL_CONTENT.startsWith(result.content.slice(0, -1))).toBe(true);
      expect(FULL_CONTENT[result.content.length - 1]).toBe(' ');
      expect(subscriptionsService.hasAccessToAuthor).not.toHaveBeenCalled();
    });

    it('un lector sin suscripción vigente recibe el adelanto', async () => {
      articleRepository.findOne.mockResolvedValue(buildPremiumArticle());
      subscriptionsService.hasAccessToAuthor.mockResolvedValue(false);

      const result = await service.findPublishedOne(3, 9);

      expect(result.locked).toBe(true);
      expect(subscriptionsService.hasAccessToAuthor).toHaveBeenCalledWith(1, 2);
    });

    it('un suscriptor vigente lee el artículo completo', async () => {
      articleRepository.findOne.mockResolvedValue(buildPremiumArticle());
      subscriptionsService.hasAccessToAuthor.mockResolvedValue(true);

      const result = await service.findPublishedOne(3, 9);

      expect(result.locked).toBe(false);
      expect(result.content).toBe(FULL_CONTENT);
    });

    it('el autor lee su artículo completo sin consultar suscripciones', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...buildPremiumArticle(),
        authorId: 1,
      });

      const result = await service.findPublishedOne(3, 9);

      expect(result.locked).toBe(false);
      expect(result.content).toBe(FULL_CONTENT);
      expect(subscriptionsService.hasAccessToAuthor).not.toHaveBeenCalled();
    });

    it('un contenido corto se devuelve sin recortar aunque esté bloqueado', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...buildPremiumArticle(),
        content: 'Texto corto',
      });
      const result = await service.findPublishedOne(3, null);
      expect(result.locked).toBe(true);
      expect(result.content).toBe('Texto corto');
    });
  });

  describe('create: comunidad exclusiva', () => {
    it('exige que el autor sea miembro activo de la comunidad', async () => {
      articleRepository.create.mockImplementation((data: object) => data);
      membershipsService.assertActiveMember.mockRejectedValueOnce(
        new ForbiddenException(),
      );

      await expect(
        service.create(9, { title: 'X', content: 'Y', communityId: 4 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(membershipsService.assertActiveMember).toHaveBeenCalledWith(4, 1);
      expect(articleRepository.save).not.toHaveBeenCalled();
    });

    it('no valida membresía cuando el artículo es público', async () => {
      articleRepository.create.mockImplementation((data: object) => data);
      await service.create(9, { title: 'X', content: 'Y' });
      expect(membershipsService.assertActiveMember).not.toHaveBeenCalled();
    });
  });

  describe('findPublishedOne: visibilidad exclusiva', () => {
    const buildExclusiveArticle = () => ({
      id: 3,
      authorId: 2,
      communityId: 4,
      status: ArticleStatus.PUBLISHED,
    });

    it('un artículo sin comunidad lo ve cualquiera', async () => {
      articleRepository.findOne.mockResolvedValue({ id: 3, communityId: null });
      await expect(service.findPublishedOne(3, null)).resolves.toMatchObject({
        id: 3,
      });
    });

    it('un artículo exclusivo se oculta a anónimos', async () => {
      articleRepository.findOne.mockResolvedValue(buildExclusiveArticle());
      await expect(service.findPublishedOne(3, null)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
    });

    it('un artículo exclusivo se oculta a quien no es miembro', async () => {
      articleRepository.findOne.mockResolvedValue(buildExclusiveArticle());
      membershipsService.isActiveMember.mockResolvedValue(false);
      await expect(service.findPublishedOne(3, 9)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
      expect(membershipsService.isActiveMember).toHaveBeenCalledWith(4, 1);
    });

    it('un artículo exclusivo lo ve un miembro activo', async () => {
      articleRepository.findOne.mockResolvedValue(buildExclusiveArticle());
      membershipsService.isActiveMember.mockResolvedValue(true);
      await expect(service.findPublishedOne(3, 9)).resolves.toMatchObject({
        id: 3,
      });
    });

    it('un artículo exclusivo lo ve su autor sin consultar membresías', async () => {
      articleRepository.findOne.mockResolvedValue({
        ...buildExclusiveArticle(),
        authorId: 1,
      });
      await expect(service.findPublishedOne(3, 9)).resolves.toMatchObject({
        id: 3,
      });
      expect(membershipsService.isActiveMember).not.toHaveBeenCalled();
    });
  });

  describe('filterViewable', () => {
    it('descarta los elementos cuyo artículo exclusivo no puede ver el lector', async () => {
      membershipsService.isActiveMember.mockImplementation(
        (communityId: number) => Promise.resolve(communityId === 4),
      );
      const items = [
        { article: { id: 1, authorId: 2, communityId: null } },
        { article: { id: 2, authorId: 2, communityId: 4 } },
        { article: { id: 3, authorId: 2, communityId: 5 } },
      ];

      const result = await service.filterViewable(
        items,
        (item) => item.article as never,
        9,
      );

      expect(result.map((item) => item.article.id)).toEqual([1, 2]);
    });

    it('a un anónimo solo le deja los artículos públicos', async () => {
      const items = [
        { article: { id: 1, authorId: 2, communityId: null } },
        { article: { id: 2, authorId: 2, communityId: 4 } },
      ];
      const result = await service.filterViewable(
        items,
        (item) => item.article as never,
        null,
      );
      expect(result.map((item) => item.article.id)).toEqual([1]);
    });
  });

  describe('findOwned', () => {
    it('lanza ForbiddenException si el artículo es de otro autor', async () => {
      articleRepository.findOne.mockResolvedValue({ id: 3, authorId: 2 });
      await expect(service.findOwned(9, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('lanza ArticleNotFoundException si no existe', async () => {
      articleRepository.findOne.mockResolvedValue(null);
      await expect(service.findOwned(9, 3)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
    });
  });

  describe('changeStatus', () => {
    it('fija publishedAt la primera vez que se publica', async () => {
      articleRepository.findOne.mockResolvedValue({
        id: 3,
        authorId: 1,
        status: ArticleStatus.DRAFT,
        publishedAt: null,
      });

      const result = await service.changeStatus(9, 3, ArticleStatus.PUBLISHED);

      expect(result.status).toBe(ArticleStatus.PUBLISHED);
      expect(result.publishedAt).toBeInstanceOf(Date);
    });

    it('conserva publishedAt al republicar un archivado', async () => {
      const publishedAt = new Date('2026-01-01');
      articleRepository.findOne.mockResolvedValue({
        id: 3,
        authorId: 1,
        status: ArticleStatus.ARCHIVED,
        publishedAt,
      });

      const result = await service.changeStatus(9, 3, ArticleStatus.PUBLISHED);

      expect(result.publishedAt).toBe(publishedAt);
    });

    it('rechaza una transición no permitida', async () => {
      articleRepository.findOne.mockResolvedValue({
        id: 3,
        authorId: 1,
        status: ArticleStatus.PUBLISHED,
      });

      await expect(
        service.changeStatus(9, 3, ArticleStatus.DRAFT),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(articleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina el artículo del autor', async () => {
      const articleObj = { id: 3, authorId: 1 };
      articleRepository.findOne.mockResolvedValue(articleObj);

      await expect(service.remove(9, 3)).resolves.toEqual({
        message: 'Article with id #3 deleted successfully',
      });
      expect(articleRepository.remove).toHaveBeenCalledWith(articleObj);
    });
  });
});
