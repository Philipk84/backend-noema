import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CollectionNotFoundException } from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { CollectionsService } from './collections.service';
import { Collection } from './entities/collection.entity';

describe('CollectionsService', () => {
  let service: CollectionsService;
  const collectionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        {
          provide: getRepositoryToken(Collection),
          useValue: collectionRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create asigna como autor al perfil del usuario', async () => {
    collectionRepository.create.mockImplementation((data: object) => data);
    await service.create(9, { title: 'Serie' });
    expect(collectionRepository.create).toHaveBeenCalledWith({
      title: 'Serie',
      authorId: 1,
    });
  });

  it('findOne lanza CollectionNotFoundException si no existe', async () => {
    collectionRepository.findOneBy.mockResolvedValue(null);
    await expect(service.findOne(4)).rejects.toBeInstanceOf(
      CollectionNotFoundException,
    );
  });

  describe('findOwned', () => {
    it('devuelve la colección del autor', async () => {
      collectionRepository.findOneBy.mockResolvedValue({ id: 4, authorId: 1 });
      await expect(service.findOwned(9, 4)).resolves.toEqual({
        id: 4,
        authorId: 1,
      });
    });

    it('lanza ForbiddenException si es de otro autor', async () => {
      collectionRepository.findOneBy.mockResolvedValue({ id: 4, authorId: 2 });
      await expect(service.findOwned(9, 4)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  it('remove no elimina colecciones ajenas', async () => {
    collectionRepository.findOneBy.mockResolvedValue({ id: 4, authorId: 2 });
    await expect(service.remove(9, 4)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(collectionRepository.remove).not.toHaveBeenCalled();
  });
});
