import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { ReadingListNotFoundException } from '../../common/exceptions/http/reading-list-not-found.exception';
import { ProfilesService } from '../../profiles/profiles.service';
import { ReadingListVisibility } from '../enums/reading-list-status.enum';
import { ReadingListItem } from './entities/reading-list-item.entity';
import { ReadingList } from './entities/reading-list.entity';
import { ReadingListsService } from './reading-lists.service';

describe('ReadingListsService', () => {
  let service: ReadingListsService;
  const readingListRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const readingListItemRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    maximum: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = {
    findByUserId: jest.fn(),
    findByUserIdOrNull: jest.fn(),
    findOne: jest.fn(),
  };
  const articlesService = { findPublishedOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadingListsService,
        {
          provide: getRepositoryToken(ReadingList),
          useValue: readingListRepository,
        },
        {
          provide: getRepositoryToken(ReadingListItem),
          useValue: readingListItemRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<ReadingListsService>(ReadingListsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create asigna la lista al perfil del usuario', async () => {
    readingListRepository.create.mockImplementation((data: object) => data);
    await service.create(9, { name: 'Pendientes' });
    expect(readingListRepository.create).toHaveBeenCalledWith({
      name: 'Pendientes',
      profileId: 1,
    });
  });

  describe('findOneVisible', () => {
    it('una lista pública es visible para cualquiera', async () => {
      readingListRepository.findOne.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PUBLIC,
      });
      await expect(service.findOneVisible(3, null)).resolves.toMatchObject({
        id: 3,
      });
    });

    it('una lista privada es visible para su dueño', async () => {
      readingListRepository.findOne.mockResolvedValue({
        id: 3,
        profileId: 1,
        visibility: ReadingListVisibility.PRIVATE,
      });
      profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
      await expect(service.findOneVisible(3, 9)).resolves.toMatchObject({
        id: 3,
      });
    });

    it('una lista privada se oculta a anónimos y a otros perfiles', async () => {
      readingListRepository.findOne.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PRIVATE,
      });
      await expect(service.findOneVisible(3, null)).rejects.toBeInstanceOf(
        ReadingListNotFoundException,
      );

      profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
      await expect(service.findOneVisible(3, 9)).rejects.toBeInstanceOf(
        ReadingListNotFoundException,
      );
    });

    it('un usuario sin perfil no ve listas privadas', async () => {
      readingListRepository.findOne.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PRIVATE,
      });
      profilesService.findByUserIdOrNull.mockResolvedValue(null);
      await expect(service.findOneVisible(3, 9)).rejects.toBeInstanceOf(
        ReadingListNotFoundException,
      );
    });
  });

  describe('permisos de edición', () => {
    it('una lista pública ajena responde 403', async () => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PUBLIC,
      });
      await expect(service.remove(9, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(readingListRepository.remove).not.toHaveBeenCalled();
    });

    it('una lista privada ajena responde 404 para no revelar su existencia', async () => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PRIVATE,
      });
      await expect(service.remove(9, 3)).rejects.toBeInstanceOf(
        ReadingListNotFoundException,
      );
    });
  });

  describe('addItem', () => {
    beforeEach(() => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 1,
        visibility: ReadingListVisibility.PRIVATE,
      });
      articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
      readingListItemRepository.create.mockImplementation(
        (data: object) => data,
      );
    });

    it('agrega el artículo al final de la lista', async () => {
      readingListItemRepository.findOneBy.mockResolvedValue(null);
      readingListItemRepository.maximum.mockResolvedValue(2);

      await service.addItem(9, 3, 5);

      expect(readingListItemRepository.create).toHaveBeenCalledWith({
        readingListId: 3,
        articleId: 5,
        orderIndex: 3,
      });
    });

    it('el primer artículo queda en la posición 0', async () => {
      readingListItemRepository.findOneBy.mockResolvedValue(null);
      readingListItemRepository.maximum.mockResolvedValue(null);

      await service.addItem(9, 3, 5);

      expect(readingListItemRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderIndex: 0 }),
      );
    });

    it('lanza ConflictException si el artículo ya está en la lista', async () => {
      readingListItemRepository.findOneBy.mockResolvedValue({ articleId: 5 });
      await expect(service.addItem(9, 3, 5)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('reorderItems', () => {
    const buildItemObjs = () => [
      { readingListId: 3, articleId: 5, orderIndex: 0 },
      { readingListId: 3, articleId: 6, orderIndex: 1 },
      { readingListId: 3, articleId: 7, orderIndex: 2 },
    ];

    beforeEach(() => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 1,
        visibility: ReadingListVisibility.PRIVATE,
      });
    });

    it('reasigna las posiciones según el orden recibido', async () => {
      readingListItemRepository.find.mockResolvedValue(buildItemObjs());

      const result = await service.reorderItems(9, 3, [7, 5, 6]);

      expect(result.map((itemObj) => itemObj.articleId)).toEqual([7, 5, 6]);
      expect(result.map((itemObj) => itemObj.orderIndex)).toEqual([0, 1, 2]);
      expect(readingListItemRepository.save).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['falta un artículo', [5, 6]],
      ['sobra un artículo que no está en la lista', [5, 6, 7, 8]],
      ['reemplaza un artículo por otro ajeno', [5, 6, 8]],
      ['repite un artículo', [5, 5, 6]],
    ])('rechaza el reorden si %s', async (_caso, articleIds) => {
      readingListItemRepository.find.mockResolvedValue(buildItemObjs());

      await expect(
        service.reorderItems(9, 3, articleIds),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(readingListItemRepository.save).not.toHaveBeenCalled();
    });

    it('no permite reordenar la lista de otro perfil', async () => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 2,
        visibility: ReadingListVisibility.PUBLIC,
      });
      await expect(
        service.reorderItems(9, 3, [5, 6, 7]),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(readingListItemRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeItem', () => {
    it('lanza NotFoundException si el artículo no está en la lista', async () => {
      readingListRepository.findOneBy.mockResolvedValue({
        id: 3,
        profileId: 1,
        visibility: ReadingListVisibility.PRIVATE,
      });
      readingListItemRepository.findOneBy.mockResolvedValue(null);
      await expect(service.removeItem(9, 3, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
