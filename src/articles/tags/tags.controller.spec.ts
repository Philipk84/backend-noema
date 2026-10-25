import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

describe('TagsController', () => {
  let controller: TagsController;
  const tagsService = { findAllInUse: jest.fn(), replaceForArticle: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [{ provide: TagsService, useValue: tagsService }],
    }).compile();

    controller = module.get<TagsController>(TagsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('replaceForArticle usa el id del usuario autenticado', async () => {
    await controller.replaceForArticle({ id: 9 } as User, 5, {
      tags: ['nestjs'],
    });
    expect(tagsService.replaceForArticle).toHaveBeenCalledWith(9, 5, {
      tags: ['nestjs'],
    });
  });
});