import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { FindNotificationsQueryDto } from './dto/find-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar las notificaciones del usuario autenticado',
  })
  @ApiOkResponse({ description: 'Notificaciones paginadas' })
  @ApiBadRequestResponse({ description: 'Parámetros de consulta inválidos' })
  findMine(
    @CurrentUser() userObj: User,
    @Query() query: FindNotificationsQueryDto,
  ) {
    return this.notificationsService.findMine(userObj.id, query);
  }

  // Declarados antes que ':id' para que no se interpreten como un id
  @Get('unread-count')
  @ApiOperation({ summary: 'Contar las notificaciones sin leer' })
  @ApiOkResponse({ description: 'Cantidad de notificaciones sin leer' })
  countUnread(@CurrentUser() userObj: User) {
    return this.notificationsService.countUnread(userObj.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiOkResponse({ description: 'Cantidad de notificaciones actualizadas' })
  markAllAsRead(@CurrentUser() userObj: User) {
    return this.notificationsService.markAllAsRead(userObj.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiOkResponse({ description: 'Notificación actualizada' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Notificación no encontrada' })
  markAsRead(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.notificationsService.markAsRead(userObj.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una notificación' })
  @ApiNoContentResponse({ description: 'Notificación eliminada' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Notificación no encontrada' })
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.notificationsService.remove(userObj.id, id);
  }
}
