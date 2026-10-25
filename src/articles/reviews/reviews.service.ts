import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewNotFoundException } from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlesService } from '../articles.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/create-review.dto';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly profilesService: ProfilesService,
    private readonly articlesService: ArticlesService,
  ) {}

  async create(
    userId: number,
    createReviewDto: CreateReviewDto,
  ): Promise<Review> {
    const profileObj = await this.profilesService.findByUserId(userId);
    // Solo se reseñan artículos publicados
    const articleObj = await this.articlesService.findPublishedOne(
      createReviewDto.articleId,
      userId,
    );
    if (articleObj.authorId === profileObj.id) {
      throw new BadRequestException('No puedes reseñar tu propio artículo');
    }

    const existingReviewObj = await this.reviewRepository.findOneBy({
      profileId: profileObj.id,
      articleId: articleObj.id,
    });
    if (existingReviewObj) {
      throw new ConflictException('Ya reseñaste este artículo');
    }

    const reviewObj = this.reviewRepository.create({
      ...createReviewDto,
      profileId: profileObj.id,
    });
    return await this.reviewRepository.save(reviewObj);
  }

  async findByArticle(
    articleId: number,
    userId: number | null,
  ): Promise<Review[]> {
    await this.articlesService.findPublishedOne(articleId, userId);
    return await this.reviewRepository.find({
      where: { articleId },
      relations: { profile: true },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    userId: number,
    id: number,
    updateReviewDto: UpdateReviewDto,
  ): Promise<Review> {
    const reviewObj = await this.findOwned(userId, id);
    this.reviewRepository.merge(reviewObj, updateReviewDto);
    return await this.reviewRepository.save(reviewObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const reviewObj = await this.findOwned(userId, id);
    await this.reviewRepository.remove(reviewObj);
    return { message: `Review with id #${id} deleted successfully` };
  }

  private async findOwned(userId: number, id: number): Promise<Review> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const reviewObj = await this.reviewRepository.findOneBy({ id });
    if (!reviewObj) {
      throw new ReviewNotFoundException(id);
    }
    if (reviewObj.profileId !== profileObj.id) {
      throw new ForbiddenException('Esta reseña pertenece a otro perfil');
    }
    return reviewObj;
  }
}
