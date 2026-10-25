import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

describe('CommentsController', () => {
  let controller: CommentsController;
  const commentsService = { create: jest.fn(), findByPost: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [{ provide: CommentsService, useValue: commentsService }],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createCommentDto = { content: 'Hola', articleId: 5 };
    await controller.create({ id: 9 } as User, createCommentDto);
    expect(commentsService.create).toHaveBeenCalledWith(9, createCommentDto);
  });

  it('findByPost pasa el usuario, o null si es anónimo', async () => {
    const query = { page: 1, limit: 20 };
    await controller.findByPost({ id: 9 } as User, 7, query);
    await controller.findByPost(null, 7, query);
    expect(commentsService.findByPost).toHaveBeenNthCalledWith(1, 7, 9, query);
    expect(commentsService.findByPost).toHaveBeenNthCalledWith(
      2,
      7,
      null,
      query,
    );
  });
});