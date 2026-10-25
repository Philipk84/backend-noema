import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from '../articles.service';
import { ArticleTag } from './entities/article-tag.entity';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  const articleTagRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };
  const articlesService = { findOwned: jest.fn(), findPublishedOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: getRepositoryToken(ArticleTag),
          useValue: articleTagRepository,
        },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('replaceForArticle', () => {
    it('normaliza las etiquetas, quita duplicados y reemplaza las anteriores', async () => {
      articlesService.findOwned.mockResolvedValue({ id: 5 });
      articleTagRepository.create.mockImplementation((data: object) => data);
      articleTagRepository.find.mockResolvedValue([{ tag: 'nestjs' }]);

      const result = await service.replaceForArticle(9, 5, {
        tags: ['NestJS', ' nestjs ', 'TypeORM'],
      });

      expect(articleTagRepository.delete).toHaveBeenCalledWith({
        articleId: 5,
      });
      expect(articleTagRepository.save).toHaveBeenCalledWith([
        { articleId: 5, tag: 'nestjs' },
        { articleId: 5, tag: 'typeorm' },
      ]);
      expect(result).toEqual(['nestjs']);
    });

    it('no modifica nada si el artículo es de otro autor', async () => {
      articlesService.findOwned.mockRejectedValue(new ForbiddenException());
      await expect(
        service.replaceForArticle(9, 5, { tags: ['nestjs'] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(articleTagRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('findByArticle', () => {
    it('devuelve las etiquetas de un artículo publicado', async () => {
      articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
      articleTagRepository.find.mockResolvedValue([
        { tag: 'nestjs' },
        { tag: 'typeorm' },
      ]);
      await expect(service.findByArticle(5, null)).resolves.toEqual([
        'nestjs',
        'typeorm',
      ]);
    });
  });
});