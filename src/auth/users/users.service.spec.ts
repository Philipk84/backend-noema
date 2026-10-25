import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import {
  RoleNotFoundException,
  UserNotFoundException,
} from '../../common/exceptions';
import { RolesService } from '../roles/roles.service';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const userRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const userRoleRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  const rolesService = { findOne: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue('4') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(UserRole), useValue: userRoleRepository },
        { provide: RolesService, useValue: rolesService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createUserDto = {
      email: 'ana@noema.com',
      password: 'Password123',
      roleIds: [1, 2],
    };

    it('hashea la contraseña y asigna cada rol', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      rolesService.findOne.mockResolvedValue({ id: 1 });
      userRepository.create.mockImplementation((data: object) => data);
      userRepository.save.mockResolvedValue({ id: 7 });
      userRoleRepository.create.mockImplementation((data: object) => data);
      userRepository.findOne.mockResolvedValue({ id: 7 });

      const result = await service.create(createUserDto);

      const createdData = userRepository.create.mock.calls[0][0] as {
        password: string;
      };
      expect(createdData.password).not.toBe('Password123');
      expect(await bcrypt.compare('Password123', createdData.password)).toBe(
        true,
      );
      expect(userRoleRepository.save).toHaveBeenCalledWith([
        { userId: 7, roleId: 1 },
        { userId: 7, roleId: 2 },
      ]);
      expect(result).toEqual({ id: 7 });
    });

    it('lanza ConflictException si el correo ya existe', async () => {
      userRepository.findOneBy.mockResolvedValue({ id: 1 });

      await expect(service.create(createUserDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('propaga RoleNotFoundException si un rol no existe', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      rolesService.findOne.mockRejectedValue(new RoleNotFoundException(1));

      await expect(service.create(createUserDto)).rejects.toBeInstanceOf(
        RoleNotFoundException,
      );
      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('retorna el usuario encontrado', async () => {
      userRepository.findOne.mockResolvedValue({ id: 3 });
      await expect(service.findOne(3)).resolves.toEqual({ id: 3 });
    });

    it('lanza UserNotFoundException si no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });
  });

  describe('update', () => {
    it('reemplaza los roles solo cuando se envía roleIds', async () => {
      userRepository.findOne.mockResolvedValue({ id: 5, email: 'a@a.com' });
      userRoleRepository.create.mockImplementation((data: object) => data);

      await service.update(5, { isActive: false });
      expect(userRoleRepository.delete).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(5, {
        isActive: false,
      });

      rolesService.findOne.mockResolvedValue({ id: 2 });
      await service.update(5, { roleIds: [2] });
      expect(userRoleRepository.delete).toHaveBeenCalledWith({ userId: 5 });
      expect(userRoleRepository.save).toHaveBeenCalledWith([
        { userId: 5, roleId: 2 },
      ]);
    });
  });

  describe('remove', () => {
    it('elimina el usuario y confirma', async () => {
      userRepository.findOne.mockResolvedValue({ id: 4 });
      await expect(service.remove(4)).resolves.toEqual({
        message: 'User with id #4 deleted successfully',
      });
      expect(userRepository.remove).toHaveBeenCalledWith({ id: 4 });
    });
  });
});
