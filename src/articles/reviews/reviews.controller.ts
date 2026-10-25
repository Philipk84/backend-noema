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
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reseñas')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Reseñar un artículo publicado y ajeno' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Artículo no disponible' })
  @ApiConflictResponse({ description: 'Ya reseñaste este artículo' })
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard('jwt'))
  create(
    @CurrentUser() userObj: User,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userObj.id, createReviewDto);
  }

  @Get('article/:articleId')
  @ApiOperation({ summary: 'Listar las reseñas de un artículo' })
  @ApiBearerAuth()
  @ApiNotFoundResponse({ description: 'Artículo no disponible' })
  @UseGuards(OptionalJwtAuthGuard)
  findByArticle(
    @CurrentUser() userObj: User | null,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    return this.reviewsService.findByArticle(articleId, userObj?.id ?? null);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar una reseña propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La reseña es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada' })
  @UseGuards(AuthGuard('jwt'))
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateReviewDto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userObj.id, id, updateReviewDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una reseña propia' })
  @ApiBearerAuth()
  @ApiForbiddenResponse({ description: 'La reseña es de otro perfil' })
  @ApiNotFoundResponse({ description: 'Reseña no encontrada' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.reviewsService.remove(userObj.id, id);
  }
}
