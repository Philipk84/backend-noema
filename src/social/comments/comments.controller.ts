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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { User } from '../../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comentarios')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Comentar un artículo o post, o responder a un comentario',
  })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Recurso no disponible' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.create(userObj.id, createCommentDto);
  }

  @Get('article/:articleId')
  @ApiOperation({ summary: 'Listar los comentarios de un artículo' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Artículo no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findByArticle(
    @CurrentUser() userObj: User | null,
    @Param('articleId', PositiveIntPipe) articleId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.findByArticle(
      articleId,
      userObj?.id ?? null,
      query,
    );
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Listar los comentarios de una publicación' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Publicación no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findByPost(
    @CurrentUser() userObj: User | null,
    @Param('postId', PositiveIntPipe) postId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentsService.findByPost(postId, userObj?.id ?? null, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un comentario propio' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El comentario es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Comentario no encontrado' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(userObj.id, id, updateCommentDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar un comentario propio, con sus respuestas',
  })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'El comentario es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Comentario no encontrado' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.commentsService.remove(userObj.id, id);
  }
}