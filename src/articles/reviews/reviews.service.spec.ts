import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ArticleNotFoundException,
  ReviewNotFoundException,
} from '../../common/exceptions';
import { ProfilesService } from '../../profiles/profiles.service';
import { ArticlesService } from '../articles.service';
import { Review } from './entities/review.entity';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  const reviewRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const articlesService = { findPublishedOne: jest.fn() };
  const createReviewDto = { articleId: 5, rating: 4 };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea la reseña con el perfil del usuario', async () => {
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 2,
      });
      reviewRepository.findOneBy.mockResolvedValue(null);
      reviewRepository.create.mockImplementation((data: object) => data);

      await service.create(9, createReviewDto);

      expect(reviewRepository.create).toHaveBeenCalledWith({
        ...createReviewDto,
        profileId: 1,
      });
      expect(reviewRepository.save).toHaveBeenCalled();
    });

    it('no permite reseñar el propio artículo', async () => {
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 1,
      });
      await expect(service.create(9, createReviewDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('lanza ConflictException si ya reseñó el artículo', async () => {
      articlesService.findPublishedOne.mockResolvedValue({
        id: 5,
        authorId: 2,
      });
      reviewRepository.findOneBy.mockResolvedValue({ id: 1 });
      await expect(service.create(9, createReviewDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('propaga ArticleNotFoundException si el artículo no está publicado', async () => {
      articlesService.findPublishedOne.mockRejectedValue(
        new ArticleNotFoundException(5),
      );
      await expect(service.create(9, createReviewDto)).rejects.toBeInstanceOf(
        ArticleNotFoundException,
      );
    });
  });

  describe('update / remove', () => {
    it('lanza ReviewNotFoundException si no existe', async () => {
      reviewRepository.findOneBy.mockResolvedValue(null);
      await expect(service.update(9, 7, { rating: 3 })).rejects.toBeInstanceOf(
        ReviewNotFoundException,
      );
    });

    it('lanza ForbiddenException si la reseña es de otro perfil', async () => {
      reviewRepository.findOneBy.mockResolvedValue({ id: 7, profileId: 2 });
      await expect(service.remove(9, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(reviewRepository.remove).not.toHaveBeenCalled();
    });

    it('permite editar la propia reseña', async () => {
      reviewRepository.findOneBy.mockResolvedValue({ id: 7, profileId: 1 });
      await service.update(9, 7, { rating: 3 });
      expect(reviewRepository.merge).toHaveBeenCalled();
      expect(reviewRepository.save).toHaveBeenCalled();
    });
  });
});
