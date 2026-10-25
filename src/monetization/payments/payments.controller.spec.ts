import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  const paymentsService = {
    findMine: jest.fn(),
    findOne: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findMine y findOne usan el id del usuario autenticado', async () => {
    const userObj = { id: 9 } as User;
    const query = { page: 1, limit: 20 };
    await controller.findMine(userObj, query);
    await controller.findOne(userObj, 7);
    expect(paymentsService.findMine).toHaveBeenCalledWith(9, query);
    expect(paymentsService.findOne).toHaveBeenCalledWith(9, 7);
  });

  it('refund delega solo el id del pago', async () => {
    await controller.refund(7);
    expect(paymentsService.refund).toHaveBeenCalledWith(7);
  });
});
