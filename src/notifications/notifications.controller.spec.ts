import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../auth/users/entities/user.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  const notificationsService = {
    findMine: jest.fn(),
    countUnread: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    remove: jest.fn(),
  };
  const userObj = { id: 9 } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('todas las operaciones usan el id del usuario autenticado', async () => {
    const query = { page: 1, limit: 20, unread: true };
    await controller.findMine(userObj, query);
    await controller.countUnread(userObj);
    await controller.markAsRead(userObj, 3);
    await controller.markAllAsRead(userObj);
    await controller.remove(userObj, 3);

    expect(notificationsService.findMine).toHaveBeenCalledWith(9, query);
    expect(notificationsService.countUnread).toHaveBeenCalledWith(9);
    expect(notificationsService.markAsRead).toHaveBeenCalledWith(9, 3);
    expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(9);
    expect(notificationsService.remove).toHaveBeenCalledWith(9, 3);
  });
});