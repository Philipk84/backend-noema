import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
import { CommunityNotFoundException } from '../common/exceptions';
import { ProfilesService } from '../profiles/profiles.service';
import { CommunitiesService } from './communities.service';
import { CommunityTag } from './entities/community-tag.entity';
import { Community } from './entities/community.entity';
import { MembershipRole, MembershipStatus } from './enums/membership.enums';
import { Membership } from './memberships/entities/membership.entity';

describe('CommunitiesService', () => {
  let service: CommunitiesService;
  const communityRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const communityTagRepository = {};
  const membershipRepository = { countBy: jest.fn(), findAndCount: jest.fn() };
  const articleRepository = { countBy: jest.fn() };
  const profilesService = { findByUserId: jest.fn() };
  const manager = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((data: object) =>
      Promise.resolve(Array.isArray(data) ? data : { id: 7, ...data }),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunitiesService,
        {
          provide: getRepositoryToken(Community),
          useValue: communityRepository,
        },
        {
          provide: getRepositoryToken(CommunityTag),
          useValue: communityTagRepository,
        },
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipRepository,
        },
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<CommunitiesService>(CommunitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createCommunityDto = {
      name: 'Nest Devs',
      topic: 'Backend',
      tags: ['NestJS', ' nestjs ', 'TypeORM'],
    };

    beforeEach(() => {
      communityRepository.findOneBy.mockResolvedValue(null);
      communityRepository.findOne.mockResolvedValue({ id: 7, tags: [] });
      membershipRepository.countBy.mockResolvedValue(1);
    });

    it('crea la comunidad y deja a su creador como OWNER activo', async () => {
      await service.create(9, createCommunityDto);

      expect(manager.create).toHaveBeenCalledWith(Membership, {
        profileId: 1,
        communityId: 7,
        role: MembershipRole.OWNER,
        status: MembershipStatus.ACTIVE,
      });
    });

    it('normaliza las etiquetas: minúsculas y sin duplicados', async () => {
      await service.create(9, createCommunityDto);

      expect(manager.create).toHaveBeenCalledWith(CommunityTag, {
        communityId: 7,
        tag: 'nestjs',
      });
      expect(manager.create).toHaveBeenCalledWith(CommunityTag, {
        communityId: 7,
        tag: 'typeorm',
      });
      expect(manager.create).toHaveBeenCalledTimes(4);
    });

    it('lanza ConflictException si el nombre ya existe', async () => {
      communityRepository.findOneBy.mockResolvedValue({ id: 3 });
      await expect(
        service.create(9, createCommunityDto),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('incluye el número de miembros activos', async () => {
      communityRepository.findOne.mockResolvedValue({ id: 3 });
      membershipRepository.countBy.mockResolvedValue(5);

      await expect(service.findOne(3)).resolves.toMatchObject({
        id: 3,
        memberCount: 5,
      });
      expect(membershipRepository.countBy).toHaveBeenCalledWith({
        communityId: 3,
        status: MembershipStatus.ACTIVE,
      });
    });

    it('lanza CommunityNotFoundException si no existe', async () => {
      communityRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(3)).rejects.toBeInstanceOf(
        CommunityNotFoundException,
      );
    });
  });

  describe('permisos del propietario', () => {
    it.each([
      ['update', () => service.update(9, 3, { description: 'x' })],
      ['replaceTags', () => service.replaceTags(9, 3, ['x'])],
      ['remove', () => service.remove(9, 3)],
    ])('%s rechaza a quien no es el propietario', async (_name, action) => {
      communityRepository.findOneBy.mockResolvedValue({ id: 3, ownerId: 2 });
      await expect(action()).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('lanza ConflictException si el nuevo nombre ya existe', async () => {
      communityRepository.findOneBy
        .mockResolvedValueOnce({ id: 3, ownerId: 1, name: 'Viejo' })
        .mockResolvedValueOnce({ id: 4 });
      await expect(
        service.update(9, 3, { name: 'Nuevo' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(communityRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('replaceTags', () => {
    it('reemplaza las etiquetas por las nuevas, normalizadas', async () => {
      communityRepository.findOneBy.mockResolvedValue({ id: 3, ownerId: 1 });

      const result = await service.replaceTags(9, 3, ['PostgreSQL', 'nestjs']);

      expect(manager.delete).toHaveBeenCalledWith(CommunityTag, {
        communityId: 3,
      });
      expect(result).toEqual(['nestjs', 'postgresql']);
    });
  });

  describe('remove', () => {
    it('no borra una comunidad con artículos exclusivos', async () => {
      communityRepository.findOneBy.mockResolvedValue({ id: 3, ownerId: 1 });
      articleRepository.countBy.mockResolvedValue(2);

      await expect(service.remove(9, 3)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(communityRepository.remove).not.toHaveBeenCalled();
    });

    it('borra una comunidad sin artículos exclusivos', async () => {
      const communityObj = { id: 3, ownerId: 1 };
      communityRepository.findOneBy.mockResolvedValue(communityObj);
      articleRepository.countBy.mockResolvedValue(0);

      await service.remove(9, 3);

      expect(communityRepository.remove).toHaveBeenCalledWith(communityObj);
    });
  });
});
