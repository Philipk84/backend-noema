import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  const collectionsService = { create: jest.fn(), findAll: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: collectionsService },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    await controller.create({ id: 9 } as User, { title: 'Serie' });
    expect(collectionsService.create).toHaveBeenCalledWith(9, {
      title: 'Serie',
    });
  });

  it('findAll filtra por autor cuando se indica', async () => {
    await controller.findAll({ authorId: 3 });
    expect(collectionsService.findAll).toHaveBeenCalledWith(3);
  });
});
