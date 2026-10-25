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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../common/pipes/positive-int.pipe';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { FindArticlesQueryDto } from './dto/find-articles-query.dto';
import { UpdateArticleStatusDto } from './dto/update-article-status.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@ApiTags('Artículos')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un artículo en borrador' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La colección es de otro autor' })
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createArticleDto: CreateArticleDto,
  ) {
    return this.articlesService.create(userObj.id, createArticleDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar artículos publicados, con filtros y paginación',
  })
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  findPublished(
    @CurrentUser() userObj: User | null,
    @Query() query: FindArticlesQueryDto,
  ) {
    return this.articlesService.findPublished(query, userObj?.id ?? null);
  }

  // Declarados antes que ':id' para que "mine" no se interprete como un id
  @Get('mine')
  @ApiOperation({ summary: 'Listar mis artículos en cualquier estado' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @UseGuards(AuthGuard('jwt'))
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.articlesService.findMine(userObj.id, query);
  }

  @Get('mine/:id')
  @ApiOperation({ summary: 'Ver uno de mis artículos con su contenido' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El artículo es de otro autor' })
  @ApiNotFoundResponse({ description: 'Artículo no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  findMineOne(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.articlesService.findOwned(userObj.id, id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ver un artículo publicado (premium: adelanto si no hay acceso)',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Artículo no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findPublishedOne(
    @CurrentUser() userObj: User | null,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.articlesService.findPublishedOne(id, userObj?.id ?? null);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un artículo propio' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El artículo es de otro autor' })
  @ApiNotFoundResponse({ description: 'Artículo no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articlesService.update(userObj.id, id, updateArticleDto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar el estado: publicar, archivar o reactivar',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El artículo es de otro autor' })
  @ApiNotFoundResponse({ description: 'Artículo no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  changeStatus(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateArticleStatusDto: UpdateArticleStatusDto,
  ) {
    return this.articlesService.changeStatus(
      userObj.id,
      id,
      updateArticleStatusDto.status,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un artículo propio' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El artículo es de otro autor' })
  @ApiNotFoundResponse({ description: 'Artículo no encontrado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.articlesService.remove(userObj.id, id);
  }
}
