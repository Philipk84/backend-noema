import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfilesService } from '../profiles.service';
import { PreferencesService } from './preferences.service';
import { UserPreference } from './entities/preference.entity';

describe('PreferencesService', () => {
  let service: PreferencesService;
  const userPreferenceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    find: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        {
          provide: getRepositoryToken(UserPreference),
          useValue: userPreferenceRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
      ],
    }).compile();

    service = module.get<PreferencesService>(PreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('replaceMine', () => {
    it('normaliza los tags, quita duplicados y reemplaza los anteriores', async () => {
      profilesService.findByUserId.mockResolvedValue({ id: 3 });
      userPreferenceRepository.create.mockImplementation(
        (data: object) => data,
      );
      userPreferenceRepository.find.mockResolvedValue([{ tag: 'nestjs' }]);

      const result = await service.replaceMine(9, {
        tags: ['NestJS', ' nestjs ', 'Postgres'],
      });

      expect(userPreferenceRepository.delete).toHaveBeenCalledWith({
        profileId: 3,
      });
      expect(userPreferenceRepository.save).toHaveBeenCalledWith([
        { profileId: 3, tag: 'nestjs' },
        { profileId: 3, tag: 'postgres' },
      ]);
      expect(result).toEqual(['nestjs']);
    });
  });
});