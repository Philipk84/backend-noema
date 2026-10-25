import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { SaveProgressDto } from './dto/save-progress.dto';
import { ProgressService } from './progress.service';

@Controller('progress')
@UseGuards(AuthGuard('jwt'))
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get()
  findMine(@CurrentUser() userObj: User, @Query() query: PaginationQueryDto) {
    return this.progressService.findMine(userObj.id, query);
  }

  @Get(':articleId')
  findOne(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    return this.progressService.findOne(userObj.id, articleId);
  }

  @Put(':articleId')
  save(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
    @Body() saveProgressDto: SaveProgressDto,
  ) {
    return this.progressService.save(userObj.id, articleId, saveProgressDto);
  }

  @Delete(':articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    await this.progressService.remove(userObj.id, articleId);
  }
}