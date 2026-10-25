import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new PermissionsGuard(reflector as unknown as Reflector);

  const buildContext = (userObj?: object) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: userObj }) }),
    }) as unknown as ExecutionContext;

  const userObj = {
    userRoles: [
      {
        role: {
          rolePermissions: [{ permission: { permissionName: 'manage_users' } }],
        },
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  it('permite el acceso si la ruta no exige permisos', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('permite el acceso si el usuario tiene los permisos', () => {
    reflector.getAllAndOverride.mockReturnValue(['manage_users']);
    expect(guard.canActivate(buildContext(userObj))).toBe(true);
  });

  it('lanza Forbidden si falta algún permiso', () => {
    reflector.getAllAndOverride.mockReturnValue([
      'manage_users',
      'manage_roles',
    ]);
    expect(() => guard.canActivate(buildContext(userObj))).toThrow(
      ForbiddenException,
    );
  });

  it('lanza Unauthorized si no hay usuario en la solicitud', () => {
    reflector.getAllAndOverride.mockReturnValue(['manage_users']);
    expect(() => guard.canActivate(buildContext())).toThrow(
      UnauthorizedException,
    );
  });
});
