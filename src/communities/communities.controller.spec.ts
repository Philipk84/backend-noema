import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../auth/users/entities/user.entity';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

describe('CommunitiesController', () => {
  let controller: CommunitiesController;
  const communitiesService = { create: jest.fn(), replaceTags: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunitiesController],
      providers: [
        { provide: CommunitiesService, useValue: communitiesService },
      ],
    }).compile();

    controller = module.get<CommunitiesController>(CommunitiesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createCommunityDto = { name: 'Nest Devs', topic: 'Backend' };
    await controller.create({ id: 9 } as User, createCommunityDto);
    expect(communitiesService.create).toHaveBeenCalledWith(
      9,
      createCommunityDto,
    );
  });

  it('replaceTags delega solo el arreglo de etiquetas', async () => {
    await controller.replaceTags({ id: 9 } as User, 3, { tags: ['nestjs'] });
    expect(communitiesService.replaceTags).toHaveBeenCalledWith(9, 3, [
      'nestjs',
    ]);
  });
});
