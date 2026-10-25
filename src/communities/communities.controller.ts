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
  Put,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { CommunitiesService } from './communities.service';
import {
  CreateCommunityDto,
  FindCommunitiesQueryDto,
  ReplaceCommunityTagsDto,
  UpdateCommunityDto,
} from './dto/create-community.dto';

@ApiTags('Comunidades')
@Controller('communities')
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una comunidad (quien la crea queda como propietario)',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @ApiConflictResponse({
    description: 'Ya existe una comunidad con ese nombre',
  })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createCommunityDto: CreateCommunityDto,
  ) {
    return this.communitiesService.create(userObj.id, createCommunityDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar comunidades, con filtros por tema, etiqueta y nombre',
  })
  findAll(@Query() query: FindCommunitiesQueryDto) {
    return this.communitiesService.findAll(query);
  }

  // Declarado antes que ':id' para que "mine" no se interprete como un id
  @Get('mine')
  @ApiOperation({ summary: 'Listar las comunidades en las que soy miembro' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @UseGuards(AuthGuard('jwt'))
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.communitiesService.findMine(userObj.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una comunidad con su número de miembros' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  findOne(@Param('id', PositiveIntPipe) id: number) {
    return this.communitiesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una comunidad propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Solo el propietario puede' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  @ApiConflictResponse({ description: 'Ya existe ese nombre' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateCommunityDto: UpdateCommunityDto,
  ) {
    return this.communitiesService.update(userObj.id, id, updateCommunityDto);
  }

  @Put(':id/tags')
  @ApiOperation({ summary: 'Reemplazar las etiquetas de una comunidad propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Solo el propietario puede' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  @UseGuards(AuthGuard('jwt'))
  replaceTags(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() replaceCommunityTagsDto: ReplaceCommunityTagsDto,
  ) {
    return this.communitiesService.replaceTags(
      userObj.id,
      id,
      replaceCommunityTagsDto.tags,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una comunidad propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'Solo el propietario puede' })
  @ApiNotFoundResponse({ description: 'Comunidad no encontrada' })
  @ApiConflictResponse({ description: 'Tiene artículos exclusivos' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.communitiesService.remove(userObj.id, id);
  }
}
