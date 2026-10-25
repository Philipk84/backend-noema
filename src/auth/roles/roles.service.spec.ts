import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  PermissionNotFoundException,
  RoleNotFoundException,
} from '../../common/exceptions';
import { PermissionsService } from '../permissions/permissions.service';
import { RolePermission } from './entities/role-permission.entity';
import { Role } from './entities/role.entity';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  const roleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const rolePermissionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const permissionsService = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: roleRepository },
        {
          provide: getRepositoryToken(RolePermission),
          useValue: rolePermissionRepository,
        },
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea el rol y le asigna los permisos', async () => {
      roleRepository.findOneBy.mockResolvedValue(null);
      roleRepository.create.mockImplementation((data: object) => data);
      roleRepository.save.mockResolvedValue({ id: 1 });
      permissionsService.findOne.mockResolvedValue({ id: 10 });
      rolePermissionRepository.create.mockImplementation(
        (data: object) => data,
      );
      roleRepository.findOne.mockResolvedValue({ id: 1 });

      await service.create({ roleName: 'ADMIN', permissionIds: [10, 11] });

      expect(rolePermissionRepository.save).toHaveBeenCalledWith([
        { roleId: 1, permissionId: 10 },
        { roleId: 1, permissionId: 11 },
      ]);
    });

    it('lanza ConflictException si el nombre ya existe', async () => {
      roleRepository.findOneBy.mockResolvedValue({ id: 2 });
      await expect(
        service.create({ roleName: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('propaga PermissionNotFoundException sin tocar la tabla pivote', async () => {
      roleRepository.findOneBy.mockResolvedValue(null);
      roleRepository.create.mockImplementation((data: object) => data);
      roleRepository.save.mockResolvedValue({ id: 1 });
      permissionsService.findOne.mockRejectedValue(
        new PermissionNotFoundException(99),
      );

      await expect(
        service.create({ roleName: 'ADMIN', permissionIds: [99] }),
      ).rejects.toBeInstanceOf(PermissionNotFoundException);
      expect(rolePermissionRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lanza RoleNotFoundException si no existe', async () => {
      roleRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(5)).rejects.toBeInstanceOf(
        RoleNotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina el rol y confirma', async () => {
      roleRepository.findOne.mockResolvedValue({ id: 3 });
      await expect(service.remove(3)).resolves.toEqual({
        message: 'Role with id #3 deleted successfully',
      });
    });
  });
});
