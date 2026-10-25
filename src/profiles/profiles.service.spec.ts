import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileNotFoundException } from '../common/exceptions';
import { Profile } from './entities/profile.entity';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  let service: ProfilesService;
  const profileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const createProfileDto = { username: 'ana_dev', name: 'Ana' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProfilesService,
        { provide: getRepositoryToken(Profile), useValue: profileRepository },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  describe('create', () => {
    it('crea el perfil enlazado al usuario autenticado', async () => {
      profileRepository.findOneBy.mockResolvedValue(null);
      profileRepository.create.mockImplementation((data: object) => data);
      profileRepository.save.mockResolvedValue({ id: 1 });

      await service.create(9, createProfileDto);

      expect(profileRepository.create).toHaveBeenCalledWith({
        ...createProfileDto,
        userId: 9,
      });
    });

    it('lanza ConflictException si el usuario ya tiene perfil', async () => {
      profileRepository.findOneBy.mockResolvedValueOnce({ id: 1 });
      await expect(service.create(9, createProfileDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(profileRepository.save).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el username está en uso', async () => {
      profileRepository.findOneBy
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2 });
      await expect(service.create(9, createProfileDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('findOne / findByUserId', () => {
    it('lanza ProfileNotFoundException si el id no existe', async () => {
      profileRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(5)).rejects.toBeInstanceOf(
        ProfileNotFoundException,
      );
    });

    it('lanza ProfileNotFoundException si el usuario no tiene perfil', async () => {
      profileRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findByUserId(5)).rejects.toBeInstanceOf(
        ProfileNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('no valida el username si no cambió', async () => {
      profileRepository.findOneBy.mockResolvedValue({
        id: 1,
        username: 'ana_dev',
      });
      profileRepository.save.mockResolvedValue({ id: 1 });

      await service.update(9, { username: 'ana_dev', name: 'Ana M.' });

      expect(profileRepository.findOneBy).toHaveBeenCalledTimes(1);
      expect(profileRepository.merge).toHaveBeenCalled();
    });

    it('lanza ConflictException si el nuevo username está en uso', async () => {
      profileRepository.findOneBy
        .mockResolvedValueOnce({ id: 1, username: 'ana_dev' })
        .mockResolvedValueOnce({ id: 2 });
      await expect(
        service.update(9, { username: 'otro' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('elimina el perfil del usuario', async () => {
      profileRepository.findOneBy.mockResolvedValue({ id: 4 });
      await expect(service.remove(9)).resolves.toEqual({
        message: 'Profile with id #4 deleted successfully',
      });
    });
  });
});
