import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  SubscriptionNotFoundException,
} from '../../common/exceptions/http/subscription-not-found.exception';
import {PaymentDeclinedException} from '../../common/exceptions/http/payment-declined.exception';
import { MembershipsService } from '../../communities/memberships/memberships.service';
import { ProfilesService } from '../../profiles/profiles.service';
import {
  BillingPeriod,
  PaymentMethod,
  PaymentStatus,
  SubscriptionStatus,
} from '../enums/monetization.enums';
import { Payment } from '../payments/entities/payment.entity';
import { PlansService } from '../plans/plans.service';
import { Subscription } from './entities/subscription.entity';
import {
  DECLINED_TEST_TOKEN,
  PaymentGateway,
  SimulatedPaymentGateway,
} from './gateway/payment-gateway';
import {
  addBillingPeriod,
  SubscriptionsService,
} from './subscriptions.service';

const DAY_MS = 86_400_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

describe('addBillingPeriod', () => {
  it('suma un mes', () => {
    expect(
      addBillingPeriod(new Date('2026-03-10T12:00:00Z'), BillingPeriod.MONTHLY),
    ).toEqual(new Date('2026-04-10T12:00:00Z'));
  });

  it('suma un año', () => {
    expect(
      addBillingPeriod(new Date('2026-03-10T12:00:00Z'), BillingPeriod.YEARLY),
    ).toEqual(new Date('2027-03-10T12:00:00Z'));
  });

  it('no desborda el mes: 31 de enero + 1 mes es fin de febrero, no marzo', () => {
    expect(
      addBillingPeriod(new Date('2026-01-31T00:00:00Z'), BillingPeriod.MONTHLY),
    ).toEqual(new Date('2026-02-28T00:00:00Z'));
  });

  it('respeta los años bisiestos', () => {
    expect(
      addBillingPeriod(new Date('2028-01-31T00:00:00Z'), BillingPeriod.MONTHLY),
    ).toEqual(new Date('2028-02-29T00:00:00Z'));
    expect(
      addBillingPeriod(new Date('2028-02-29T00:00:00Z'), BillingPeriod.YEARLY),
    ).toEqual(new Date('2029-02-28T00:00:00Z'));
  });

  it('cruza el fin de año', () => {
    expect(
      addBillingPeriod(new Date('2026-12-15T00:00:00Z'), BillingPeriod.MONTHLY),
    ).toEqual(new Date('2027-01-15T00:00:00Z'));
  });
});

describe('SimulatedPaymentGateway', () => {
  const gateway = new SimulatedPaymentGateway();
  const request = {
    amount: 5,
    currency: 'USD',
    method: PaymentMethod.CARD,
  };

  it('aprueba el cobro y devuelve una referencia', async () => {
    const result = await gateway.charge(request);
    expect(result.approved).toBe(true);
    expect(result.reference.startsWith('SIM-')).toBe(true);
  });

  it('rechaza el token de prueba tok_declined', async () => {
    const result = await gateway.charge({
      ...request,
      token: DECLINED_TEST_TOKEN,
    });
    expect(result.approved).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('cada cobro tiene una referencia distinta', async () => {
    const first = await gateway.charge(request);
    const second = await gateway.charge(request);
    expect(first.reference).not.toBe(second.reference);
  });
});

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  const subscriptionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const plansService = { findOne: jest.fn(), isOwnedBy: jest.fn() };
  const membershipsService = {
    assertNotBanned: jest.fn(),
    grantFromSubscription: jest.fn(),
    revokeSubscriptionMembership: jest.fn(),
  };
  const paymentGateway = { charge: jest.fn() };
  const manager = { create: jest.fn(), save: jest.fn() };
  const dataSource = {
    manager,
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  const buildPlan = (overrides: Record<string, unknown> = {}) => ({
    id: 4,
    authorId: 2,
    communityId: null,
    price: 5.99,
    currency: 'USD',
    billingPeriod: BillingPeriod.MONTHLY,
    isActive: true,
    ...overrides,
  });
  const buildSubscription = (overrides: Record<string, unknown> = {}) => ({
    id: 10,
    profileId: 1,
    planId: 4,
    plan: buildPlan(),
    status: SubscriptionStatus.ACTIVE,
    startDate: daysFromNow(-10),
    endDate: daysFromNow(20),
    autoRenew: false,
    ...overrides,
  });
  const subscribeDto = {
    planId: 4,
    paymentMethod: PaymentMethod.CARD,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    plansService.findOne.mockResolvedValue(buildPlan());
    plansService.isOwnedBy.mockResolvedValue(false);
    subscriptionRepository.find.mockResolvedValue([]);
    subscriptionRepository.findOneBy.mockResolvedValue(null);
    subscriptionRepository.save.mockImplementation((obj: object) =>
      Promise.resolve(obj),
    );
    paymentGateway.charge.mockResolvedValue({
      approved: true,
      reference: 'SIM-1',
    });
    manager.create.mockImplementation((_entity: unknown, data: object) => data);
    manager.save.mockImplementation((...args: unknown[]) =>
      Promise.resolve(
        args.length === 2 ? args[1] : { id: 10, ...(args[0] as object) },
      ),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: PlansService, useValue: plansService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: PaymentGateway, useValue: paymentGateway },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    // El resultado final se relee con findOwned
    subscriptionRepository.findOne.mockResolvedValue(buildSubscription());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('cobra el precio del plan y guarda suscripción y pago PAID en una transacción', async () => {
      await service.subscribe(9, subscribeDto);

      expect(paymentGateway.charge).toHaveBeenCalledWith({
        amount: 5.99,
        currency: 'USD',
        method: PaymentMethod.CARD,
        token: undefined,
      });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      const subscriptionData = manager.create.mock.calls[0][1] as {
        status: SubscriptionStatus;
        startDate: Date;
        endDate: Date;
      };
      expect(subscriptionData.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscriptionData.endDate.getTime()).toBeGreaterThan(
        subscriptionData.startDate.getTime() + 27 * DAY_MS,
      );
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          amount: 5.99,
          currency: 'USD',
          status: PaymentStatus.PAID,
          externalReference: 'SIM-1',
          paidAt: expect.any(Date) as Date,
        }),
      );
    });

    it('un pago rechazado responde 402 y no guarda nada', async () => {
      paymentGateway.charge.mockResolvedValue({
        approved: false,
        reference: 'SIM-2',
        reason: 'Fondos insuficientes',
      });

      await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
        PaymentDeclinedException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('no cobra si el plan está retirado', async () => {
      plansService.findOne.mockResolvedValue(buildPlan({ isActive: false }));
      await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentGateway.charge).not.toHaveBeenCalled();
    });

    it('no cobra si el usuario es el titular del plan', async () => {
      plansService.isOwnedBy.mockResolvedValue(true);
      await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentGateway.charge).not.toHaveBeenCalled();
    });

    it('rechaza una segunda suscripción mientras la primera esté vigente', async () => {
      subscriptionRepository.findOneBy.mockResolvedValue(buildSubscription());
      await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(paymentGateway.charge).not.toHaveBeenCalled();
    });

    it('una suscripción cancelada pero vigente tampoco se duplica', async () => {
      subscriptionRepository.findOneBy.mockResolvedValue(
        buildSubscription({ status: SubscriptionStatus.CANCELLED }),
      );
      await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('reutiliza una suscripción vencida como renovación', async () => {
      const expiredSubscriptionObj = buildSubscription({
        status: SubscriptionStatus.EXPIRED,
        endDate: daysFromNow(-3),
      });
      subscriptionRepository.findOneBy.mockResolvedValue(
        expiredSubscriptionObj,
      );
      subscriptionRepository.findOne.mockResolvedValue(expiredSubscriptionObj);

      await service.subscribe(9, subscribeDto);

      expect(expiredSubscriptionObj.status).toBe(SubscriptionStatus.ACTIVE);
      // Vencida: el nuevo periodo cuenta desde hoy, no desde la fecha vieja
      expect(expiredSubscriptionObj.endDate.getTime()).toBeGreaterThan(
        Date.now() + 27 * DAY_MS,
      );
      expect(manager.create).not.toHaveBeenCalled();
    });

    describe('planes de comunidad', () => {
      beforeEach(() => {
        plansService.findOne.mockResolvedValue(
          buildPlan({ authorId: null, communityId: 8 }),
        );
      });

      it('un vetado no paga: se comprueba antes de cobrar', async () => {
        membershipsService.assertNotBanned.mockRejectedValueOnce(
          new ForbiddenException('vetado'),
        );
        await expect(service.subscribe(9, subscribeDto)).rejects.toBeInstanceOf(
          ForbiddenException,
        );
        expect(membershipsService.assertNotBanned).toHaveBeenCalledWith(1, 8);
        expect(paymentGateway.charge).not.toHaveBeenCalled();
      });

      it('al pagar se concede la membresía de la comunidad', async () => {
        await service.subscribe(9, subscribeDto);
        expect(membershipsService.grantFromSubscription).toHaveBeenCalledWith(
          1,
          8,
        );
      });
    });

    it('un plan de autor no toca membresías', async () => {
      await service.subscribe(9, subscribeDto);
      expect(membershipsService.assertNotBanned).not.toHaveBeenCalled();
      expect(membershipsService.grantFromSubscription).not.toHaveBeenCalled();
    });
  });

  describe('renew', () => {
    const renewDto = { paymentMethod: PaymentMethod.PAYPAL };

    it('extiende el periodo desde el fin actual, no desde hoy', async () => {
      const subscriptionObj = buildSubscription({ endDate: daysFromNow(10) });
      const previousEndTime = subscriptionObj.endDate.getTime();
      subscriptionRepository.findOne.mockResolvedValue(subscriptionObj);

      await service.renew(9, 10, renewDto);

      // 10 días que quedaban + ~1 mes: no se pierde lo ya pagado
      expect(subscriptionObj.endDate.getTime()).toBeGreaterThan(
        previousEndTime + 27 * DAY_MS,
      );
      expect(subscriptionObj.status).toBe(SubscriptionStatus.ACTIVE);
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          status: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.PAYPAL,
        }),
      );
    });

    it('una cancelada vuelve a ACTIVE al renovar', async () => {
      const subscriptionObj = buildSubscription({
        status: SubscriptionStatus.CANCELLED,
      });
      subscriptionRepository.findOne.mockResolvedValue(subscriptionObj);
      await service.renew(9, 10, renewDto);
      expect(subscriptionObj.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('un cobro rechazado deja un pago FAILED y no cambia la suscripción', async () => {
      const subscriptionObj = buildSubscription();
      const previousEndTime = subscriptionObj.endDate.getTime();
      subscriptionRepository.findOne.mockResolvedValue(subscriptionObj);
      paymentGateway.charge.mockResolvedValue({
        approved: false,
        reference: 'SIM-9',
        reason: 'Rechazado',
      });

      await expect(service.renew(9, 10, renewDto)).rejects.toBeInstanceOf(
        PaymentDeclinedException,
      );
      expect(manager.save).toHaveBeenCalledWith(
        Payment,
        expect.objectContaining({
          status: PaymentStatus.FAILED,
          paidAt: null,
        }),
      );
      expect(subscriptionObj.endDate.getTime()).toBe(previousEndTime);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('un plan retirado no se renueva y no se cobra', async () => {
      subscriptionRepository.findOne.mockResolvedValue(
        buildSubscription({ plan: buildPlan({ isActive: false }) }),
      );
      await expect(service.renew(9, 10, renewDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(paymentGateway.charge).not.toHaveBeenCalled();
    });

    it('no renueva la suscripción de otro perfil', async () => {
      subscriptionRepository.findOne.mockResolvedValue(
        buildSubscription({ profileId: 2 }),
      );
      await expect(service.renew(9, 10, renewDto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(paymentGateway.charge).not.toHaveBeenCalled();
    });

    it('lanza SubscriptionNotFoundException si no existe', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);
      await expect(service.renew(9, 10, renewDto)).rejects.toBeInstanceOf(
        SubscriptionNotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('marca CANCELLED, quita la autorenovación y conserva endDate', async () => {
      const subscriptionObj = buildSubscription({ autoRenew: true });
      const previousEndDate = subscriptionObj.endDate;
      subscriptionRepository.findOne.mockResolvedValue(subscriptionObj);

      const result = await service.cancel(9, 10);

      expect(result.status).toBe(SubscriptionStatus.CANCELLED);
      expect(result.autoRenew).toBe(false);
      expect(result.endDate).toBe(previousEndDate);
    });

    it.each([SubscriptionStatus.CANCELLED, SubscriptionStatus.EXPIRED])(
      'no cancela una suscripción %s',
      async (status) => {
        subscriptionRepository.findOne.mockResolvedValue(
          buildSubscription({ status }),
        );
        await expect(service.cancel(9, 10)).rejects.toBeInstanceOf(
          BadRequestException,
        );
      },
    );
  });

  describe('expireOverdue', () => {
    it('no hace nada si no hay suscripciones vencidas', async () => {
      await expect(service.expireOverdue()).resolves.toBe(0);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it('marca EXPIRED y retira la membresía solo de los planes de comunidad', async () => {
      subscriptionRepository.find.mockResolvedValue([
        buildSubscription({
          id: 1,
          profileId: 5,
          plan: buildPlan({ authorId: null, communityId: 8 }),
        }),
        buildSubscription({ id: 2, profileId: 6 }),
      ]);

      await expect(service.expireOverdue()).resolves.toBe(2);

      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        expect.anything(),
        { status: SubscriptionStatus.EXPIRED, autoRenew: false },
      );
      expect(
        membershipsService.revokeSubscriptionMembership,
      ).toHaveBeenCalledTimes(1);
      expect(
        membershipsService.revokeSubscriptionMembership,
      ).toHaveBeenCalledWith(5, 8);
    });
  });

  describe('hasAccessToAuthor', () => {
    it('consulta suscripciones vigentes a planes del autor', async () => {
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest.fn().mockResolvedValue(true),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.hasAccessToAuthor(1, 2)).resolves.toBe(true);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'plan.authorId = :authorId',
        { authorId: 2 },
      );
      // Una cancelada sigue dando acceso hasta endDate; una expirada no
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'subscription.status IN (:...statuses)',
        {
          statuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'subscription.endDate > :now',
        { now: expect.any(Date) as Date },
      );
    });
  });
});
