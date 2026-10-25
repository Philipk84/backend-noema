import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { User } from '../../auth/users/entities/user.entity';
import { PositiveIntPipe } from '../../common/pipes/positive-int.pipe';
import { ReplaceArticleTagsDto } from './dto/replace-article-tag.dto';
import { TagsService } from './tags.service';

@Controller('article-tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  findAllInUse() {
    return this.tagsService.findAllInUse();
  }

  @Get('article/:articleId')
  @UseGuards(OptionalJwtAuthGuard)
  findByArticle(
    @CurrentUser() userObj: User | null,
    @Param('articleId', PositiveIntPipe) articleId: number,
  ) {
    return this.tagsService.findByArticle(articleId, userObj?.id ?? null);
  }

  @Put('article/:articleId')
  @UseGuards(AuthGuard('jwt'))
  replaceForArticle(
    @CurrentUser() userObj: User,
    @Param('articleId', PositiveIntPipe) articleId: number,
    @Body() replaceArticleTagsDto: ReplaceArticleTagsDto,
  ) {
    return this.tagsService.replaceForArticle(
      userObj.id,
      articleId,
      replaceArticleTagsDto,
    );
  }
}