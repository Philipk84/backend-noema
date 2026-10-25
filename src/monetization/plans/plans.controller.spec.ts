import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../auth/users/entities/user.entity';
import { BillingPeriod } from '../enums/monetization.enums';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

describe('PlansController', () => {
  let controller: PlansController;
  const plansService = { create: jest.fn(), findAll: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [{ provide: PlansService, useValue: plansService }],
    }).compile();

    controller = module.get<PlansController>(PlansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create usa el id del usuario autenticado', async () => {
    const createPlanDto = {
      name: 'Mensual',
      price: 5,
      currency: 'USD',
      billingPeriod: BillingPeriod.MONTHLY,
    };
    await controller.create({ id: 9 } as User, createPlanDto);
    expect(plansService.create).toHaveBeenCalledWith(9, createPlanDto);
  });

  it('findAll delega los filtros', async () => {
    const query = { page: 1, limit: 20, authorId: 2 };
    await controller.findAll(query);
    expect(plansService.findAll).toHaveBeenCalledWith(query);
  });
});
