import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from './users/users.service';
import { RevokedToken } from './entities/revoked-token.entity';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { findByEmail: jest.fn() };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-token'),
    verify: jest.fn(),
  };
  const revokedTokensRepository = {
    create: jest.fn((token) => token),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    save: jest.fn().mockImplementation((token) => Promise.resolve(token)),
  };

  const buildUserObj = (isActive = true) => ({
    id: 1,
    email: 'ana@noema.com',
    password: bcrypt.hashSync('Password123', 4),
    isActive,
    userRoles: [
      {
        role: {
          roleName: 'ADMIN',
          rolePermissions: [
            { permission: { permissionName: 'manage_users' } },
            { permission: { permissionName: 'manage_roles' } },
          ],
        },
      },
      {
        role: {
          roleName: 'EDITOR',
          rolePermissions: [{ permission: { permissionName: 'manage_users' } }],
        },
      },
    ],
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: getRepositoryToken(RevokedToken),
          useValue: revokedTokensRepository,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('firma un token con roles y permisos sin duplicados', async () => {
      usersService.findByEmail.mockResolvedValue(buildUserObj());

      const result = await service.login({
        email: 'ana@noema.com',
        password: 'Password123',
      });

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 1,
          email: 'ana@noema.com',
          roles: ['ADMIN', 'EDITOR'],
          permissions: ['manage_users', 'manage_roles'],
          jti: expect.any(String),
        }),
      );
      expect(result.access_token).toBe('signed-token');
    });

    it('invalida el token actual y conserva su fecha de expiración', async () => {
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      jwtService.verify.mockReturnValue({
        sub: 1,
        jti: 'token-id',
        exp: expiration,
      });

      await expect(service.logout('signed-token')).resolves.toEqual({
        message: 'Sesión cerrada correctamente',
      });
      expect(revokedTokensRepository.save).toHaveBeenCalledWith({
        jti: 'token-id',
        expiresAt: new Date(expiration * 1000),
      });
    });

    it('rechaza tokens sin identificador o vencimiento', async () => {
      jwtService.verify.mockReturnValue({ sub: 1 });
      await expect(service.logout('signed-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza tokens que no se pueden verificar', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      await expect(service.logout('bad-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza una contraseña incorrecta', async () => {
      usersService.findByEmail.mockResolvedValue(buildUserObj());
      await expect(
        service.login({ email: 'ana@noema.com', password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza un correo inexistente con el mismo error', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'Password123' }),
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('rechaza un usuario inactivo', async () => {
      usersService.findByEmail.mockResolvedValue(buildUserObj(false));
      await expect(
        service.login({ email: 'ana@noema.com', password: 'Password123' }),
      ).rejects.toThrow('inactivo');
    });
  });
});
