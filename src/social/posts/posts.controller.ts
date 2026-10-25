import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { CreatePostDto, FindPostsQueryDto } from './dto/create-post.dto';
import { PostsService } from './posts.service';

@ApiTags('Publicaciones')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiOperation({ summary: 'Publicar: original, respuesta, repost o cita' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'No se puede republicar ese post' })
  @ApiNotFoundResponse({ description: 'Post o artículo no disponible' })
  @ApiConflictResponse({ description: 'Ya republicaste ese post' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(@CurrentUser() userObj: User, @Body() createPostDto: CreatePostDto) {
    return this.postsService.create(userObj.id, createPostDto);
  }

  // Con token incluye las publicaciones de seguidores que el lector puede ver
  @Get()
  @ApiOperation({ summary: 'Feed de publicaciones visibles para el lector' })
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  findFeed(
    @CurrentUser() userObj: User | null,
    @Query() query: FindPostsQueryDto,
  ) {
    return this.postsService.findFeed(userObj?.id ?? null, query);
  }

  // Declarado antes que ':id' para que "mine" no se interprete como un id
  @Get('mine')
  @ApiOperation({ summary: 'Listar mis publicaciones' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'El usuario no tiene perfil' })
  @UseGuards(AuthGuard('jwt'))
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.postsService.findMine(userObj.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver una publicación' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Publicación no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @CurrentUser() userObj: User | null,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.postsService.findVisible(id, userObj?.id ?? null);
  }

  @Get(':id/replies')
  @ApiOperation({ summary: 'Listar las respuestas de una publicación' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Publicación no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findReplies(
    @CurrentUser() userObj: User | null,
    @Param('id', PositiveIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postsService.findReplies(id, userObj?.id ?? null, query);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una publicación propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La publicación es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Publicación no disponible' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.postsService.remove(userObj.id, id);
  }
}