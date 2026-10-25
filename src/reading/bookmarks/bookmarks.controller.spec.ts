import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

describe('BookmarksController', () => {
  let controller: BookmarksController;
  const bookmarksService = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookmarksController],
      providers: [{ provide: BookmarksService, useValue: bookmarksService }],
    }).compile();

    controller = module.get<BookmarksController>(BookmarksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createBookmarkDto = {
      articleId: 5,
      highlightedText: 'fragmento',
      startPosition: 0,
      endPosition: 9,
    };
    await controller.create({ id: 9 } as User, createBookmarkDto);
    expect(bookmarksService.create).toHaveBeenCalledWith(9, createBookmarkDto);
  });
});
