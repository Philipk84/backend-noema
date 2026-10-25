import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../auth/users/entities/user.entity';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ArticleStatus } from './enums/article-status.enum';

describe('ArticlesController', () => {
  let controller: ArticlesController;
  const articlesService = { create: jest.fn(), changeStatus: jest.fn() };
  const userObj = { id: 9 } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [{ provide: ArticlesService, useValue: articlesService }],
    }).compile();

    controller = module.get<ArticlesController>(ArticlesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createArticleDto = { title: 'Hola', content: 'Texto' };
    await controller.create(userObj, createArticleDto);
    expect(articlesService.create).toHaveBeenCalledWith(9, createArticleDto);
  });

  it('changeStatus delega el estado solicitado', async () => {
    await controller.changeStatus(userObj, 3, {
      status: ArticleStatus.PUBLISHED,
    });
    expect(articlesService.changeStatus).toHaveBeenCalledWith(
      9,
      3,
      ArticleStatus.PUBLISHED,
    );
  });
});
