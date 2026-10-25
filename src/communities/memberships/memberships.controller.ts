import {
  Body,
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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import {
  FindMembersQueryDto,
  UpdateMembershipDto,
} from './dto/update-membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('Membresías')
@Controller('communities/:communityId/members')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @ApiOperation({
    summary: 'Unirse a una comunidad (premium: queda pendiente de aprobación)',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Estás vetado de la comunidad' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  @ApiConflictResponse({ description: 'Ya eres miembro o tienes solicitud' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  join(
    @CurrentUser() userObj: User,
    @Param('communityId', PositiveIntPipe) communityId: number,
  ) {
    return this.membershipsService.join(userObj.id, communityId);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar miembros (pendientes y vetados: solo moderación)',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Solo propietario y moderadores' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  @UseGuards(OptionalJwtAuthGuard)
  findMembers(
    @CurrentUser() userObj: User | null,
    @Param('communityId', PositiveIntPipe) communityId: number,
    @Query() query: FindMembersQueryDto,
  ) {
    return this.membershipsService.findMembers(
      communityId,
      userObj?.id ?? null,
      query,
    );
  }

  // Declarado antes que ':profileId' para que "me" no se interprete como un id
  @Delete('me')
  @ApiOperation({ summary: 'Abandonar la comunidad' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Un vetado no puede abandonarla' })
  @ApiNotFoundResponse({ description: 'No eres miembro' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async leave(
    @CurrentUser() userObj: User,
    @Param('communityId', PositiveIntPipe) communityId: number,
  ) {
    await this.membershipsService.leave(userObj.id, communityId);
  }

  @Patch(':profileId')
  @ApiOperation({ summary: 'Aprobar, vetar o cambiar el rol de un miembro' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Sin permiso sobre ese miembro' })
  @ApiNotFoundResponse({ description: 'Miembro no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('communityId', PositiveIntPipe) communityId: number,
    @Param('profileId', PositiveIntPipe) profileId: number,
    @Body() updateMembershipDto: UpdateMembershipDto,
  ) {
    return this.membershipsService.update(
      userObj.id,
      communityId,
      profileId,
      updateMembershipDto,
    );
  }

  @Delete(':profileId')
  @ApiOperation({ summary: 'Expulsar a un miembro' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Sin permiso sobre ese miembro' })
  @ApiNotFoundResponse({ description: 'Miembro no encontrado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async kick(
    @CurrentUser() userObj: User,
    @Param('communityId', PositiveIntPipe) communityId: number,
    @Param('profileId', PositiveIntPipe) profileId: number,
  ) {
    await this.membershipsService.kick(userObj.id, communityId, profileId);
  }
}
