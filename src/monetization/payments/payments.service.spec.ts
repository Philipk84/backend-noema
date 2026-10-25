import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PaymentNotFoundException } from '../../common/exceptions/http/payment-not-found.exception';
import { MembershipsService } from '../../communities/memberships/memberships.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { PaymentStatus, SubscriptionStatus } from '../enums/monetization.enums';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const paymentRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };
  const profilesService = { findByUserId: jest.fn() };
  const membershipsService = { revokeSubscriptionMembership: jest.fn() };
  const manager = { save: jest.fn() };
  const dataSource = {
    transaction: jest.fn((callback: (m: typeof manager) => unknown) =>
      callback(manager),
    ),
  };

  const buildPaidPayment = (communityId: number | null = null) => {
    const subscriptionObj = {
      id: 10,
      profileId: 5,
      status: SubscriptionStatus.ACTIVE,
      endDate: new Date(Date.now() + 20 * 86_400_000),
      autoRenew: true,
      plan: { id: 4, communityId },
    };
    return {
      id: 7,
      profileId: 5,
      status: PaymentStatus.PAID,
      subscription: subscriptionObj,
    };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepository },
        { provide: ProfilesService, useValue: profilesService },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findMine', () => {
    it('lista solo los pagos del perfil, filtrando por suscripción si se indica', async () => {
      paymentRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findMine(9, { page: 1, limit: 20, subscriptionId: 10 });
      expect(paymentRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { profileId: 1, subscriptionId: 10 },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('lanza PaymentNotFoundException si no existe', async () => {
      paymentRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(9, 7)).rejects.toBeInstanceOf(
        PaymentNotFoundException,
      );
    });

    it('no muestra el pago de otro perfil', async () => {
      paymentRepository.findOneBy.mockResolvedValue({ id: 7, profileId: 2 });
      await expect(service.findOne(9, 7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('refund', () => {
    it('marca REFUNDED y termina la suscripción al instante', async () => {
      const paymentObj = buildPaidPayment();
      paymentRepository.findOne.mockResolvedValue(paymentObj);

      const result = await service.refund(7);

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      const { subscription: subscriptionObj } = paymentObj;
      expect(subscriptionObj.status).toBe(SubscriptionStatus.EXPIRED);
      expect(subscriptionObj.autoRenew).toBe(false);
      expect(subscriptionObj.endDate.getTime()).toBeLessThanOrEqual(Date.now());
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledTimes(2);
    });

    it('en un plan de autor no toca membresías', async () => {
      paymentRepository.findOne.mockResolvedValue(buildPaidPayment(null));
      await service.refund(7);
      expect(
        membershipsService.revokeSubscriptionMembership,
      ).not.toHaveBeenCalled();
    });

    it('en un plan de comunidad retira la membresía del suscriptor', async () => {
      paymentRepository.findOne.mockResolvedValue(buildPaidPayment(8));
      await service.refund(7);
      expect(
        membershipsService.revokeSubscriptionMembership,
      ).toHaveBeenCalledWith(5, 8);
    });

    it.each([
      PaymentStatus.REFUNDED,
      PaymentStatus.FAILED,
      PaymentStatus.PENDING,
    ])('no reembolsa un pago %s', async (status) => {
      paymentRepository.findOne.mockResolvedValue({
        ...buildPaidPayment(),
        status,
      });
      await expect(service.refund(7)).rejects.toBeInstanceOf(ConflictException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('lanza PaymentNotFoundException si no existe', async () => {
      paymentRepository.findOne.mockResolvedValue(null);
      await expect(service.refund(7)).rejects.toBeInstanceOf(
        PaymentNotFoundException,
      );
    });
  });
});
