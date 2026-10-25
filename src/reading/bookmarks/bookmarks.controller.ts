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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { BookmarksService } from './bookmarks.service';
import {
  CreateBookmarkDto,
  FindBookmarksQueryDto,
  UpdateBookmarkDto,
} from './dto/create-bookmark.dto';

@Controller('bookmarks')
@UseGuards(AuthGuard('jwt'))
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() userObj: User,
    @Body() createBookmarkDto: CreateBookmarkDto,
  ) {
    return this.bookmarksService.create(userObj.id, createBookmarkDto);
  }

  @Get()
  findMine(
    @CurrentUser() userObj: User,
    @Query() query: FindBookmarksQueryDto,
  ) {
    return this.bookmarksService.findMine(userObj.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    return this.bookmarksService.findOne(userObj.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
    @Body() updateBookmarkDto: UpdateBookmarkDto,
  ) {
    return this.bookmarksService.update(userObj.id, id, updateBookmarkDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() userObj: User,
    @Param('id', PositiveIntPipe) id: number,
  ) {
    await this.bookmarksService.remove(userObj.id, id);
  }
}
