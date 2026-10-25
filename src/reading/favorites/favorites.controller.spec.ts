import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  const favoritesService = { add: jest.fn(), remove: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [{ provide: FavoritesService, useValue: favoritesService }],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('add y remove usan el id del usuario autenticado', async () => {
    const userObj = { id: 9 } as User;
    await controller.add(userObj, 5);
    await controller.remove(userObj, 5);
    expect(favoritesService.add).toHaveBeenCalledWith(9, 5);
    expect(favoritesService.remove).toHaveBeenCalledWith(9, 5);
  });
});