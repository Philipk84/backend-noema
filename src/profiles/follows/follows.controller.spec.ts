import { Test, TestingModule } from '@nestjs/testing';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';
import { User } from '../../auth/users/entities/user.entity';

describe('FollowsController', () => {
  let controller: FollowsController;
  const followsService = { follow: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [{ provide: FollowsService, useValue: followsService }],
    }).compile();

    controller = module.get<FollowsController>(FollowsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('follow delega con el id del usuario autenticado', async () => {
    followsService.follow.mockResolvedValue({ followerId: 1, followedId: 2 });
    await controller.follow({ id: 9 } as User, 2);
    expect(followsService.follow).toHaveBeenCalledWith(9, 2);
  });
});
