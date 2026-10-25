import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionNotFoundException } from '../../common/exceptions';
import { Permission } from './entities/permission.entity';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  const permissionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
          useValue: permissionRepository,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('guarda el permiso cuando el nombre está libre', async () => {
      permissionRepository.findOneBy.mockResolvedValue(null);
      permissionRepository.create.mockReturnValue({ permissionName: 'x' });
      permissionRepository.save.mockResolvedValue({ id: 1 });

      await expect(service.create({ permissionName: 'x' })).resolves.toEqual({
        id: 1,
      });
    });

    it('lanza ConflictException si el nombre ya existe', async () => {
      permissionRepository.findOneBy.mockResolvedValue({ id: 1 });
      await expect(
        service.create({ permissionName: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(permissionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lanza PermissionNotFoundException si no existe', async () => {
      permissionRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(8)).rejects.toBeInstanceOf(
        PermissionNotFoundException,
      );
    });
  });
});
