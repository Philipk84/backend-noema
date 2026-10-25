import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { BookmarkNotFoundException } from '../../common/exceptions/http/bookmark-not-found.exception';
import { ProfilesService } from '../../profiles/profiles.service';
import { BookmarksService } from './bookmarks.service';
import { Bookmark } from './entities/bookmark.entity';

describe('BookmarksService', () => {
  let service: BookmarksService;
  const bookmarkRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const articlesService = { findPublishedOne: jest.fn() };
  const createBookmarkDto = {
    articleId: 5,
    highlightedText: 'fragmento',
    startPosition: 10,
    endPosition: 19,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        { provide: getRepositoryToken(Bookmark), useValue: bookmarkRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea el marcador con el perfil del usuario', async () => {
      bookmarkRepository.create.mockImplementation((data: object) => data);
      await service.create(9, createBookmarkDto);
      expect(bookmarkRepository.create).toHaveBeenCalledWith({
        ...createBookmarkDto,
        profileId: 1,
      });
    });

    it('rechaza un rango donde endPosition no supera a startPosition', async () => {
      await expect(
        service.create(9, { ...createBookmarkDto, endPosition: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookmarkRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findMine', () => {
    it('filtra por artículo cuando se indica', async () => {
      bookmarkRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findMine(9, { page: 1, limit: 20, articleId: 5 });
      expect(bookmarkRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { profileId: 1, articleId: 5 } }),
      );
    });

    it('no filtra por artículo si no se indica', async () => {
      bookmarkRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findMine(9, { page: 1, limit: 20 });
      expect(bookmarkRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { profileId: 1 } }),
      );
    });
  });

  describe('findOne / update / remove', () => {
    it('lanza BookmarkNotFoundException si no existe', async () => {
      bookmarkRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(9, 7)).rejects.toBeInstanceOf(
        BookmarkNotFoundException,
      );
    });

    it('lanza ForbiddenException si el marcador es de otro perfil', async () => {
      bookmarkRepository.findOneBy.mockResolvedValue({ id: 7, profileId: 2 });
      await expect(service.remove(9, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(bookmarkRepository.remove).not.toHaveBeenCalled();
    });

    it('permite editar la nota del propio marcador', async () => {
      bookmarkRepository.findOneBy.mockResolvedValue({ id: 7, profileId: 1 });
      await service.update(9, 7, { note: 'revisar' });
      expect(bookmarkRepository.merge).toHaveBeenCalledWith(
        { id: 7, profileId: 1 },
        { note: 'revisar' },
      );
      expect(bookmarkRepository.save).toHaveBeenCalled();
    });
  });
});
