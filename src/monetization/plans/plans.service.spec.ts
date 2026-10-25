import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PlanNotFoundException } from '../../common/exceptions/http/plan-not-found.exception';
import { CommunitiesService } from '../../communities/communities.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { BillingPeriod } from '../enums/monetization.enums';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { Plan } from './entities/plan.entity';
import { PlansService } from './plans.service';

describe('PlansService', () => {
  let service: PlansService;
  const planRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    merge: jest.fn(),
    remove: jest.fn(),
  };
  const subscriptionRepository = { countBy: jest.fn() };
  const profilesService = { findByUserId: jest.fn() };
  const communitiesService = { findEntity: jest.fn() };
  const createPlanDto = {
    name: 'Mensual',
    price: 5,
    currency: 'USD',
    billingPeriod: BillingPeriod.MONTHLY,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    planRepository.create.mockImplementation((data: object) => data);
    planRepository.save.mockImplementation((data: object) =>
      Promise.resolve(data),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: getRepositoryToken(Plan), useValue: planRepository },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subscriptionRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: CommunitiesService, useValue: communitiesService },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('sin communityId crea un plan del autor', async () => {
      const result = await service.create(9, createPlanDto);
      expect(result).toMatchObject({ authorId: 1, communityId: null });
      expect(communitiesService.findEntity).not.toHaveBeenCalled();
    });

    it('con communityId crea un plan de la comunidad sin autor', async () => {
      communitiesService.findEntity.mockResolvedValue({ id: 8, ownerId: 1 });
      const result = await service.create(9, {
        ...createPlanDto,
        communityId: 8,
      });
      expect(result).toMatchObject({ authorId: null, communityId: 8 });
    });

    it('solo el propietario crea planes de la comunidad', async () => {
      communitiesService.findEntity.mockResolvedValue({ id: 8, ownerId: 2 });
      await expect(
        service.create(9, { ...createPlanDto, communityId: 8 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(planRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('el catálogo público solo incluye planes activos', async () => {
      planRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({ page: 1, limit: 20 });
      expect(planRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('filtra por autor o comunidad cuando se indica', async () => {
      planRepository.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({
        page: 1,
        limit: 20,
        authorId: 2,
        communityId: 8,
      });
      expect(planRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, authorId: 2, communityId: 8 },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('lanza PlanNotFoundException si no existe', async () => {
      planRepository.findOneBy.mockResolvedValue(null);
      await expect(service.findOne(4)).rejects.toBeInstanceOf(
        PlanNotFoundException,
      );
    });
  });

  describe('isOwnedBy', () => {
    it('un plan de autor pertenece a su autor', async () => {
      const planObj = { authorId: 1, communityId: null } as Plan;
      await expect(service.isOwnedBy(planObj, 1)).resolves.toBe(true);
      await expect(service.isOwnedBy(planObj, 2)).resolves.toBe(false);
    });

    it('un plan de comunidad pertenece al propietario de la comunidad', async () => {
      const planObj = { authorId: null, communityId: 8 } as Plan;
      communitiesService.findEntity.mockResolvedValue({ id: 8, ownerId: 1 });
      await expect(service.isOwnedBy(planObj, 1)).resolves.toBe(true);
      await expect(service.isOwnedBy(planObj, 2)).resolves.toBe(false);
    });
  });

  describe('update / remove', () => {
    it('no permite editar un plan ajeno', async () => {
      planRepository.findOneBy.mockResolvedValue({
        id: 4,
        authorId: 2,
        communityId: null,
      });
      await expect(service.update(9, 4, { price: 1 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(planRepository.save).not.toHaveBeenCalled();
    });

    it('edita el precio de un plan propio', async () => {
      const planObj = { id: 4, authorId: 1, communityId: null, price: 5 };
      planRepository.findOneBy.mockResolvedValue(planObj);
      await service.update(9, 4, { price: 7 });
      expect(planRepository.merge).toHaveBeenCalledWith(planObj, { price: 7 });
      expect(planRepository.save).toHaveBeenCalled();
    });

    it('no borra un plan con suscripciones: hay que retirarlo con isActive', async () => {
      planRepository.findOneBy.mockResolvedValue({
        id: 4,
        authorId: 1,
        communityId: null,
      });
      subscriptionRepository.countBy.mockResolvedValue(3);

      const promise = service.remove(9, 4);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('isActive');
      expect(planRepository.remove).not.toHaveBeenCalled();
    });

    it('borra un plan sin suscripciones', async () => {
      const planObj = { id: 4, authorId: 1, communityId: null };
      planRepository.findOneBy.mockResolvedValue(planObj);
      subscriptionRepository.countBy.mockResolvedValue(0);
      await service.remove(9, 4);
      expect(planRepository.remove).toHaveBeenCalledWith(planObj);
    });
  });
});
