import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { Profile } from '../entities/profile.entity';
import { Follow } from './entities/follow.entity';
import { FollowsService } from './follows.service';

@ApiTags('Follows')
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':profileId')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Seguir a un perfil',
    description:
      'El perfil del usuario autenticado empieza a seguir al perfil indicado.',
  })
  @ApiParam({
    name: 'profileId',
    description: 'Identificador del perfil a seguir',
    type: Number,
    example: 2,
  })
  @ApiCreatedResponse({ description: 'Seguimiento creado', type: Follow })
  @ApiBadRequestResponse({
    description:
      'El id no es un entero positivo o se intentó seguir al propio perfil',
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiNotFoundResponse({
    description:
      'El usuario autenticado no tiene perfil o el perfil a seguir no existe',
  })
  @ApiConflictResponse({ description: 'Ya se sigue a este perfil' })
  follow(
    @CurrentUser() userObj: User,
    @Param('profileId', PositiveIntPipe) profileId: number,
  ) {
    return this.followsService.follow(userObj.id, profileId);
  }

  @Delete(':profileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dejar de seguir a un perfil' })
  @ApiParam({
    name: 'profileId',
    description: 'Identificador del perfil a dejar de seguir',
    type: Number,
    example: 2,
  })
  @ApiNoContentResponse({ description: 'Seguimiento eliminado' })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiUnauthorizedResponse({ description: 'Token JWT ausente o inválido' })
  @ApiNotFoundResponse({
    description:
      'El usuario autenticado no tiene perfil o no sigue al perfil indicado',
  })
  async unfollow(
    @CurrentUser() userObj: User,
    @Param('profileId', PositiveIntPipe) profileId: number,
  ) {
    await this.followsService.unfollow(userObj.id, profileId);
  }

  @Get('followers/:profileId')
  @ApiOperation({ summary: 'Listar los seguidores de un perfil' })
  @ApiParam({
    name: 'profileId',
    description: 'Identificador del perfil',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Perfiles que siguen al perfil indicado',
    type: [Profile],
  })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Perfil no encontrado' })
  findFollowers(@Param('profileId', PositiveIntPipe) profileId: number) {
    return this.followsService.findFollowers(profileId);
  }

  @Get('following/:profileId')
  @ApiOperation({ summary: 'Listar los perfiles que sigue un perfil' })
  @ApiParam({
    name: 'profileId',
    description: 'Identificador del perfil',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Perfiles seguidos por el perfil indicado',
    type: [Profile],
  })
  @ApiBadRequestResponse({ description: 'El id debe ser un entero positivo' })
  @ApiNotFoundResponse({ description: 'Perfil no encontrado' })
  findFollowing(@Param('profileId', PositiveIntPipe) profileId: number) {
    return this.followsService.findFollowing(profileId);
  }
}
