import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  const reviewsService = { create: jest.fn(), findByArticle: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: reviewsService }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createReviewDto = { articleId: 5, rating: 4 };
    await controller.create({ id: 9 } as User, createReviewDto);
    expect(reviewsService.create).toHaveBeenCalledWith(9, createReviewDto);
  });

  it('findByArticle delega el id del artículo', async () => {
    reviewsService.findByArticle.mockResolvedValue([]);
    await expect(controller.findByArticle(null, 5)).resolves.toEqual([]);
    expect(reviewsService.findByArticle).toHaveBeenCalledWith(5, null);
  });
});
