import {
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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.favoritesService.findMine(userObj.id, query);
  }

  @Post(':articleId')
  @HttpCode(HttpStatus.CREATED)
  add(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    return this.favoritesService.add(userObj.id, articleId);
  }

  @Delete(':articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    await this.favoritesService.remove(userObj.id, articleId);
  }
}