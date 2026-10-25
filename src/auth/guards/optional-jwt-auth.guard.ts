import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../users/entities/user.entity';

/**
 * Como AuthGuard('jwt'), pero sin token (o con uno inválido) la solicitud
 * continúa como anónima: request.user queda en null en lugar de lanzar 401.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = User>(_err: unknown, user: TUser | false): TUser {
    return (user || null) as TUser;
  }
}
