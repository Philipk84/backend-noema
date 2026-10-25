import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { User } from '../users/entities/user.entity';
import { extractPermissionNames } from '../utils/user-access.util';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userObj = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().user;
    if (!userObj) {
      throw new UnauthorizedException('Usuario no autenticado en la solicitud');
    }

    const userPermissions = extractPermissionNames(userObj);
    const hasAllRequiredPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
    if (!hasAllRequiredPermissions) {
      throw new ForbiddenException(
        'Acceso denegado: No cuentas con los permisos suficientes para esta acción',
      );
    }
    return true;
  }
}
