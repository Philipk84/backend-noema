import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { Paginated } from '../../common/dto/pagination-query.dto';
import { BookmarkNotFoundException } from '../../common/exceptions/http/bookmark-not-found.exception';
import { ProfilesService } from '../../profiles/profiles.service';
import {
  CreateBookmarkDto,
  FindBookmarksQueryDto,
  UpdateBookmarkDto,
} from './dto/create-bookmark.dto';
import { Bookmark } from './entities/bookmark.entity';

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepository: Repository<Bookmark>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
  ) {}

  async create(
    userId: number,
    createBookmarkDto: CreateBookmarkDto,
  ): Promise<Bookmark> {
    if (createBookmarkDto.endPosition <= createBookmarkDto.startPosition) {
      throw new BadRequestException(
        'endPosition debe ser mayor que startPosition',
      );
    }
    const profileObj = await this.profilesService.findByUserId(userId);
    const articleObj = await this.articlesService.findPublishedOne(
      createBookmarkDto.articleId, userId
    );

    const bookmarkObj = this.bookmarkRepository.create({
      ...createBookmarkDto,
      articleId: articleObj.id,
      profileId: profileObj.id,
    });
    return await this.bookmarkRepository.save(bookmarkObj);
  }

  async findMine(
    userId: number,
    query: FindBookmarksQueryDto,
  ): Promise<Paginated<Bookmark>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.bookmarkRepository.findAndCount({
      where: {
        profileId: profileObj.id,
        ...(query.articleId !== undefined && { articleId: query.articleId }),
      },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(userId: number, id: number): Promise<Bookmark> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const bookmarkObj = await this.bookmarkRepository.findOneBy({ id });
    if (!bookmarkObj) {
      throw new BookmarkNotFoundException(id);
    }
    if (bookmarkObj.profileId !== profileObj.id) {
      throw new ForbiddenException('Este marcador pertenece a otro perfil');
    }
    return bookmarkObj;
  }

  async update(
    userId: number,
    id: number,
    updateBookmarkDto: UpdateBookmarkDto,
  ): Promise<Bookmark> {
    const bookmarkObj = await this.findOne(userId, id);
    this.bookmarkRepository.merge(bookmarkObj, updateBookmarkDto);
    return await this.bookmarkRepository.save(bookmarkObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const bookmarkObj = await this.findOne(userId, id);
    await this.bookmarkRepository.remove(bookmarkObj);
    return { message: `Bookmark with id #${id} deleted successfully` };
  }
}
