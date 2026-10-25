import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { ProfilesService } from '../../profiles/profiles.service';
import { Favorite } from './entities/favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
  ) {}

  async add(userId: number, articleId: number): Promise<Favorite> {
    const profileObj = await this.profilesService.findByUserId(userId);
    // Solo se marcan como favoritos artículos publicados
    const articleObj = await this.articlesService.findPublishedOne(
      articleId,
      userId,
    );

    const existingFavoriteObj = await this.favoriteRepository.findOneBy({
      profileId: profileObj.id,
      articleId: articleObj.id,
    });
    if (existingFavoriteObj) {
      throw new ConflictException('El artículo ya está en tus favoritos');
    }

    const favoriteObj = this.favoriteRepository.create({
      profileId: profileObj.id,
      articleId: articleObj.id,
    });
    return await this.favoriteRepository.save(favoriteObj);
  }

  async remove(
    userId: number,
    articleId: number,
  ): Promise<{ message: string }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const favoriteObj = await this.favoriteRepository.findOneBy({
      profileId: profileObj.id,
      articleId,
    });
    if (!favoriteObj) {
      throw new NotFoundException('El artículo no está en tus favoritos');
    }
    await this.favoriteRepository.remove(favoriteObj);
    return { message: `Article #${articleId} removed from favorites` };
  }

  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Favorite>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.favoriteRepository.findAndCount({
      where: { profileId: profileObj.id },
      relations: { article: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    // Si dejó la comunidad, sus artículos exclusivos ya no se muestran
    const viewableData = await this.articlesService.filterViewable(
      data,
      (favoriteObj) => favoriteObj.article,
      userId,
    );
    return { data: viewableData, total, page: query.page, limit: query.limit };
  }
}