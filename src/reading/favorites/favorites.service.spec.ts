import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { ArticleNotFoundException } from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { Favorite } from './entities/favorite.entity';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;
  const favoriteRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const articlesService = {
    findPublishedOne: jest.fn(),
    filterViewable: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    articlesService.filterViewable.mockImplementation((items: unknown[]) =>
      Promise.resolve(items),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: getRepositoryToken(Favorite), useValue: favoriteRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('add', () => {
    it('agrega el artículo publicado a los favoritos del perfil', async () => {
      articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
      favoriteRepository.findOneBy.mockResolvedValue(null);
      favoriteRepository.create.mockImplementation((data: object) => data);

      await service.add(9, 5);

      expect(favoriteRepository.create).toHaveBeenCalledWith({
        profileId: 1,
        articleId: 5,
      });
      expect(favoriteRepository.save).toHaveBeenCalled();
    });

    it('lanza ConflictException si ya es favorito', async () => {
      articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
      favoriteRepository.findOneBy.mockResolvedValue({ articleId: 5 });
      await expect(service.add(9, 5)).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga ArticleNotFoundException si el artículo no está publicado', async () => {
      articlesService.findPublishedOne.mockRejectedValue(
        new ArticleNotFoundException(5),
      );
      await expect(service.add(9, 5)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
      expect(favoriteRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('elimina el favorito', async () => {
      const favoriteObj = { profileId: 1, articleId: 5 };
      favoriteRepository.findOneBy.mockResolvedValue(favoriteObj);
      await service.remove(9, 5);
      expect(favoriteRepository.remove).toHaveBeenCalledWith(favoriteObj);
    });

    it('lanza NotFoundException si no era favorito', async () => {
      favoriteRepository.findOneBy.mockResolvedValue(null);
      await expect(service.remove(9, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findMine', () => {
    it('pagina los favoritos del perfil', async () => {
      favoriteRepository.findAndCount.mockResolvedValue([
        [{ articleId: 5 }],
        1,
      ]);
      await expect(
        service.findMine(9, { page: 2, limit: 10 }),
      ).resolves.toEqual({
        data: [{ articleId: 5 }],
        total: 1,
        page: 2,
        limit: 10,
      });
      expect(favoriteRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });
});