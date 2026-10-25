import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { PreferencesController } from './preferences.controller';
import { PreferencesService } from './preferences.service';

describe('PreferencesController', () => {
  let controller: PreferencesController;
  const preferencesService = { findMine: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [
        { provide: PreferencesService, useValue: preferencesService },
      ],
    }).compile();

    controller = module.get<PreferencesController>(PreferencesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findMine delega con el id del usuario autenticado', async () => {
    preferencesService.findMine.mockResolvedValue(['nestjs']);
    await expect(controller.findMine({ id: 9 } as User)).resolves.toEqual([
      'nestjs',
    ]);
    expect(preferencesService.findMine).toHaveBeenCalledWith(9);
  });
});