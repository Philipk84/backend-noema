import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { PaymentMethod } from '../enums/monetization.enums';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  const subscriptionsService = {
    subscribe: jest.fn(),
    renew: jest.fn(),
    cancel: jest.fn(),
  };
  const userObj = { id: 9 } as User;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('subscribe usa el id del usuario autenticado', async () => {
    const createSubscriptionDto = {
      planId: 4,
      paymentMethod: PaymentMethod.CARD,
    };
    await controller.subscribe(userObj, createSubscriptionDto);
    expect(subscriptionsService.subscribe).toHaveBeenCalledWith(
      9,
      createSubscriptionDto,
    );
  });

  it('renew y cancel delegan con el usuario y el id', async () => {
    const renewDto = { paymentMethod: PaymentMethod.PAYPAL };
    await controller.renew(userObj, 10, renewDto);
    await controller.cancel(userObj, 10);
    expect(subscriptionsService.renew).toHaveBeenCalledWith(9, 10, renewDto);
    expect(subscriptionsService.cancel).toHaveBeenCalledWith(9, 10);
  });
});
