import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ArticlesService } from '../../articles/articles.service';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { ProfilesService } from '../../profiles/profiles.service';
import { SaveProgressDto } from './dto/save-progress.dto';
import { ReadingProgress } from './entities/reading-progress.entity';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(ReadingProgress)
    private readonly readingProgressRepository: Repository<ReadingProgress>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
  ) {}

  /** Crea o actualiza el avance del perfil en el artículo. */
  async save(
    userId: number,
    articleId: number,
    saveProgressDto: SaveProgressDto,
  ): Promise<ReadingProgress> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const articleObj = await this.articlesService.findPublishedOne(
      articleId,
      userId,
    );

    const readingProgressObj =
      (await this.readingProgressRepository.findOneBy({
        profileId: profileObj.id,
        articleId: articleObj.id,
      })) ??
      this.readingProgressRepository.create({
        profileId: profileObj.id,
        articleId: articleObj.id,
      });

    readingProgressObj.percentage = saveProgressDto.percentage;
    // Se recalcula: si el lector vuelve a empezar, deja de estar completado
    readingProgressObj.isCompleted = saveProgressDto.percentage >= 100;
    readingProgressObj.lastReadAt = new Date();
    return await this.readingProgressRepository.save(readingProgressObj);
  }

  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<ReadingProgress>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.readingProgressRepository.findAndCount({
      where: { profileId: profileObj.id },
      relations: { article: true },
      order: { lastReadAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    // Si dejó la comunidad, sus artículos exclusivos ya no se muestran
    const viewableData = await this.articlesService.filterViewable(
      data,
      (readingProgressObj) => readingProgressObj.article,
      userId,
    );
    return { data: viewableData, total, page: query.page, limit: query.limit };
  }

  async findOne(userId: number, articleId: number): Promise<ReadingProgress> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const readingProgressObj = await this.readingProgressRepository.findOneBy({
      profileId: profileObj.id,
      articleId,
    });
    if (!readingProgressObj) {
      throw new NotFoundException('Aún no registras avance en este artículo');
    }
    return readingProgressObj;
  }

  async remove(
    userId: number,
    articleId: number,
  ): Promise<{ message: string }> {
    const readingProgressObj = await this.findOne(userId, articleId);
    await this.readingProgressRepository.remove(readingProgressObj);
    return {
      message: `Progress on article #${articleId} deleted successfully`,
    };
  }
}