import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { ReactionTargetType, ReactionType } from '../enums/reaction.enums';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

describe('ReactionsController', () => {
  let controller: ReactionsController;
  const reactionsService = {
    set: jest.fn(),
    remove: jest.fn(),
    summary: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReactionsController],
      providers: [{ provide: ReactionsService, useValue: reactionsService }],
    }).compile();

    controller = module.get<ReactionsController>(ReactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('set usa el id del usuario autenticado y el tipo del cuerpo', async () => {
    await controller.set({ id: 9 } as User, ReactionTargetType.POST, 7, {
      type: ReactionType.LOVE,
    });
    expect(reactionsService.set).toHaveBeenCalledWith(
      9,
      ReactionTargetType.POST,
      7,
      ReactionType.LOVE,
    );
  });

  it('summary pasa null cuando la solicitud es anónima', async () => {
    await controller.summary(null, ReactionTargetType.ARTICLE, 5);
    expect(reactionsService.summary).toHaveBeenCalledWith(
      ReactionTargetType.ARTICLE,
      5,
      null,
    );
  });
});