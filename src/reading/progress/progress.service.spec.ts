import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArticlesService } from '../../articles/articles.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { ReadingProgress } from './entities/reading-progress.entity';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  let service: ProgressService;
  const readingProgressRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const articlesService = { findPublishedOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    articlesService.findPublishedOne.mockResolvedValue({ id: 5 });
    readingProgressRepository.save.mockImplementation((obj: object) => obj);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        {
          provide: getRepositoryToken(ReadingProgress),
          useValue: readingProgressRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: ArticlesService, useValue: articlesService },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('save', () => {
    it('crea el avance si no existía y lo marca no completado', async () => {
      readingProgressRepository.findOneBy.mockResolvedValue(null);
      readingProgressRepository.create.mockImplementation((data: object) => ({
        ...data,
      }));

      const result = await service.save(9, 5, { percentage: 40.5 });

      expect(readingProgressRepository.create).toHaveBeenCalledWith({
        profileId: 1,
        articleId: 5,
      });
      expect(result.percentage).toBe(40.5);
      expect(result.isCompleted).toBe(false);
      expect(result.lastReadAt).toBeInstanceOf(Date);
    });

    it('marca como completado al llegar al 100%', async () => {
      readingProgressRepository.findOneBy.mockResolvedValue({
        profileId: 1,
        articleId: 5,
        percentage: 80,
      });
      const result = await service.save(9, 5, { percentage: 100 });
      expect(result.isCompleted).toBe(true);
    });

    it('deja de estar completado si el lector vuelve a empezar', async () => {
      readingProgressRepository.findOneBy.mockResolvedValue({
        profileId: 1,
        articleId: 5,
        percentage: 100,
        isCompleted: true,
      });
      const result = await service.save(9, 5, { percentage: 10 });
      expect(result.isCompleted).toBe(false);
    });
  });

  describe('findOne / remove', () => {
    it('lanza NotFoundException si no hay avance registrado', async () => {
      readingProgressRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(9, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.remove(9, 5)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});