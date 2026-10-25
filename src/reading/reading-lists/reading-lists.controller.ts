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
  AddReadingListItemDto,
  CreateReadingListDto,
  ReorderReadingListItemsDto,
  UpdateReadingListDto,
} from './dto/create-reading-list.dto';
import { ReadingListsService } from './reading-lists.service';

@ApiTags('Listas de lectura')
@Controller('reading-lists')
export class ReadingListsController {
  constructor(private readonly readingListsService: ReadingListsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una lista de lectura' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createReadingListDto: CreateReadingListDto,
  ) {
    return this.readingListsService.create(userObj.id, createReadingListDto);
  }

  // Declarados antes que ':id' para que "mine" y "profile" no se interpreten como un id
  @Get('mine')
  @ApiOperation({ summary: 'Listar mis listas de lectura' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @UseGuards(AuthGuard('jwt'))
  findMine(@CurrentUser() userObj: User) {
    return this.readingListsService.findMine(userObj.id);
  }

  @Get('profile/:profileId')
  @ApiOperation({ summary: 'Listar las listas públicas de un perfil' })
  @ApiNotFoundResponse({ description: 'Perfil no encontrado' })
  findPublicByProfile(@Param('profileId', PositiveIntPipe) profileId: number) {
    return this.readingListsService.findPublicByProfile(profileId);
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Ver una lista con sus artículos en orden (las privadas, solo su dueño)',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Lista no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @CurrentUser() userObj: User | null,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.readingListsService.findOneVisible(id, userObj?.id ?? null);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una lista propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La lista es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Lista no encontrada' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateReadingListDto: UpdateReadingListDto,
  ) {
    return this.readingListsService.update(
      userObj.id,
      id,
      updateReadingListDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una lista propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La lista es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Lista no encontrada' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.readingListsService.remove(userObj.id, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Agregar un artículo al final de la lista' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La lista es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Lista o artículo no disponible' })
  @ApiConflictResponse({ description: 'El artículo ya está en la lista' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  addItem(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() addReadingListItemDto: AddReadingListItemDto,
  ) {
    return this.readingListsService.addItem(
      userObj.id,
      id,
      addReadingListItemDto.articleId,
    );
  }

  @Put(':id/items/order')
  @ApiOperation({ summary: 'Reordenar los artículos de la lista' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La lista es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Lista no encontrada' })
  @UseGuards(AuthGuard('jwt'))
  reorderItems(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() reorderReadingListItemsDto: ReorderReadingListItemsDto,
  ) {
    return this.readingListsService.reorderItems(
      userObj.id,
      id,
      reorderReadingListItemsDto.articleIds,
    );
  }

  @Delete(':id/items/:articleId')
  @ApiOperation({ summary: 'Quitar un artículo de la lista' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La lista es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Lista o artículo no encontrado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async removeItem(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    await this.readingListsService.removeItem(userObj.id, id, articleId);
  }
}
