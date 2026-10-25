import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { ReadingListsController } from './reading-lists.controller';
import { ReadingListsService } from './reading-lists.service';

describe('ReadingListsController', () => {
  let controller: ReadingListsController;
  const readingListsService = {
    findOneVisible: jest.fn(),
    addItem: jest.fn(),
    reorderItems: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadingListsController],
      providers: [
        { provide: ReadingListsService, useValue: readingListsService },
      ],
    }).compile();

    controller = module.get<ReadingListsController>(ReadingListsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findOne pasa el usuario autenticado, o null si es anónimo', async () => {
    await controller.findOne({ id: 9 } as User, 3);
    await controller.findOne(null, 3);
    expect(readingListsService.findOneVisible).toHaveBeenNthCalledWith(1, 3, 9);
    expect(readingListsService.findOneVisible).toHaveBeenNthCalledWith(
      2,
      3,
      null,
    );
  });

  it('reorderItems delega el nuevo orden de articleIds', async () => {
    await controller.reorderItems({ id: 9 } as User, 3, {
      articleIds: [7, 5, 6],
    });
    expect(readingListsService.reorderItems).toHaveBeenCalledWith(
      9,
      3,
      [7, 5, 6],
    );
  });

  it('addItem usa el id del usuario y el articleId del cuerpo', async () => {
    await controller.addItem({ id: 9 } as User, 3, { articleId: 5 });
    expect(readingListsService.addItem).toHaveBeenCalledWith(9, 3, 5);
  });
});
