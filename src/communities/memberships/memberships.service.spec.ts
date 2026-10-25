import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfilesService } from '../../profiles/profiles.service';
import { CommunitiesService } from '../communities.service';
import { MembershipRole, MembershipStatus } from '../enums/membership.enums';
import { Membership } from './entities/membership.entity';
import { MembershipsService } from './memberships.service';

describe('MembershipsService', () => {
  let service: MembershipsService;
  const eventEmitter = { emitAsync: jest.fn() };
  const membershipRepository = {
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    existsBy: jest.fn(),
    delete: jest.fn(),
  };
  const profilesService = {
    findByUserId: jest.fn(),
    findByUserIdOrNull: jest.fn(),
  };
  const communitiesService = { findEntity: jest.fn() };

  const buildMembership = (overrides: Partial<Membership> = {}) =>
    ({
      profileId: 5,
      communityId: 3,
      role: MembershipRole.MEMBER,
      status: MembershipStatus.ACTIVE,
      ...overrides,
    }) as Membership;

  /** El actor (perfil 1) y el objetivo (perfil 5) en la comunidad 3. */
  const mockActorAndTarget = (
    actorOverrides: Partial<Membership>,
    targetOverrides: Partial<Membership> = {},
  ) => {
    const actorMembershipObj = buildMembership({
      profileId: 1,
      role: MembershipRole.OWNER,
      ...actorOverrides,
    });
    const targetMembershipObj = buildMembership(targetOverrides);
    membershipRepository.findOneBy.mockImplementation(
      (where: { profileId: number }) =>
        Promise.resolve(
          where.profileId === 1 ? actorMembershipObj : targetMembershipObj,
        ),
    );
    return { actorMembershipObj, targetMembershipObj };
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    profilesService.findByUserId.mockResolvedValue({ id: 1 });
    profilesService.findByUserIdOrNull.mockResolvedValue({ id: 1 });
    communitiesService.findEntity.mockResolvedValue({
      id: 3,
      isPremium: false,
    });
    membershipRepository.create.mockImplementation((data: object) => data);
    membershipRepository.save.mockImplementation((data: object) =>
      Promise.resolve(data),
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembershipsService,
        {
          provide: getRepositoryToken(Membership),
          useValue: membershipRepository,
        },
        { provide: ProfilesService, useValue: profilesService },
        { provide: CommunitiesService, useValue: communitiesService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<MembershipsService>(MembershipsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('join', () => {
    it('en una comunidad abierta el miembro queda ACTIVE', async () => {
      membershipRepository.findOneBy.mockResolvedValue(null);
      const result = await service.join(9, 3);
      expect(result).toMatchObject({
        profileId: 1,
        communityId: 3,
        role: MembershipRole.MEMBER,
        status: MembershipStatus.ACTIVE,
      });
    });

    it('en una comunidad premium queda PENDING', async () => {
      communitiesService.findEntity.mockResolvedValue({
        id: 3,
        isPremium: true,
      });
      membershipRepository.findOneBy.mockResolvedValue(null);
      const result = await service.join(9, 3);
      expect(result.status).toBe(MembershipStatus.PENDING);
    });

    it('la solicitud PENDING avisa al propietario de la comunidad', async () => {
      communitiesService.findEntity.mockResolvedValue({
        id: 3,
        isPremium: true,
        ownerId: 7,
      });
      membershipRepository.findOneBy.mockResolvedValue(null);

      await service.join(9, 3);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'membership.requested',
        { communityId: 3, actorId: 1, ownerId: 7 },
      );
    });

    it('unirse a una comunidad abierta no genera aviso', async () => {
      membershipRepository.findOneBy.mockResolvedValue(null);
      await service.join(9, 3);
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('un vetado no puede volver a unirse', async () => {
      membershipRepository.findOneBy.mockResolvedValue(
        buildMembership({ status: MembershipStatus.BANNED }),
      );
      await expect(service.join(9, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it.each([
      [MembershipStatus.ACTIVE, 'Ya eres miembro'],
      [MembershipStatus.PENDING, 'pendiente'],
    ])('si ya está como %s lanza ConflictException', async (status, text) => {
      membershipRepository.findOneBy.mockResolvedValue(
        buildMembership({ status }),
      );
      const promise = service.join(9, 3);
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(text);
    });
  });

  describe('leave', () => {
    it('elimina la membresía de un miembro', async () => {
      const membershipObj = buildMembership({ profileId: 1 });
      membershipRepository.findOneBy.mockResolvedValue(membershipObj);
      await service.leave(9, 3);
      expect(membershipRepository.remove).toHaveBeenCalledWith(membershipObj);
    });

    it('el propietario no puede abandonar', async () => {
      membershipRepository.findOneBy.mockResolvedValue(
        buildMembership({ role: MembershipRole.OWNER }),
      );
      await expect(service.leave(9, 3)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('un vetado no puede abandonar para limpiar su veto', async () => {
      membershipRepository.findOneBy.mockResolvedValue(
        buildMembership({ status: MembershipStatus.BANNED }),
      );
      await expect(service.leave(9, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(membershipRepository.remove).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si no era miembro', async () => {
      membershipRepository.findOneBy.mockResolvedValue(null);
      await expect(service.leave(9, 3)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findMembers', () => {
    const query = { page: 1, limit: 20 };

    beforeEach(() => {
      membershipRepository.findAndCount.mockResolvedValue([[], 0]);
    });

    it('los miembros activos son públicos, incluso para anónimos', async () => {
      await service.findMembers(3, null, query);
      expect(membershipRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { communityId: 3, status: MembershipStatus.ACTIVE },
        }),
      );
    });

    it('ver pendientes o vetados se niega a anónimos', async () => {
      await expect(
        service.findMembers(3, null, {
          ...query,
          status: MembershipStatus.PENDING,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('ver pendientes o vetados se niega a un miembro común', async () => {
      membershipRepository.findOneBy.mockResolvedValue(buildMembership());
      await expect(
        service.findMembers(3, 9, {
          ...query,
          status: MembershipStatus.BANNED,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un moderador sí puede ver los pendientes', async () => {
      membershipRepository.findOneBy.mockResolvedValue(
        buildMembership({ role: MembershipRole.MODERATOR }),
      );
      await service.findMembers(3, 9, {
        ...query,
        status: MembershipStatus.PENDING,
      });
      expect(membershipRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { communityId: 3, status: MembershipStatus.PENDING },
        }),
      );
    });
  });

  describe('update', () => {
    it('exige indicar role o status', async () => {
      await expect(service.update(9, 3, 5, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('el propietario cambia el rol de un miembro', async () => {
      const { targetMembershipObj } = mockActorAndTarget({});
      await service.update(9, 3, 5, { role: MembershipRole.MODERATOR });
      expect(targetMembershipObj.role).toBe(MembershipRole.MODERATOR);
    });

    it('aprobar una solicitud PENDING avisa al solicitante', async () => {
      mockActorAndTarget(
        { role: MembershipRole.MODERATOR },
        { status: MembershipStatus.PENDING },
      );

      await service.update(9, 3, 5, { status: MembershipStatus.ACTIVE });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        'membership.approved',
        { communityId: 3, actorId: 1, recipientId: 5 },
      );
    });

    it.each([
      ['un veto', MembershipStatus.ACTIVE, MembershipStatus.BANNED],
      ['una reinstalación', MembershipStatus.BANNED, MembershipStatus.ACTIVE],
    ])('%s no genera aviso', async (_caso, from, to) => {
      mockActorAndTarget({}, { status: from });
      await service.update(9, 3, 5, { status: to });
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('cambiar solo el rol no genera aviso', async () => {
      mockActorAndTarget({}, { status: MembershipStatus.PENDING });
      await service.update(9, 3, 5, { role: MembershipRole.MODERATOR });
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('un moderador veta a un miembro común', async () => {
      const { targetMembershipObj } = mockActorAndTarget({
        role: MembershipRole.MODERATOR,
      });
      await service.update(9, 3, 5, { status: MembershipStatus.BANNED });
      expect(targetMembershipObj.status).toBe(MembershipStatus.BANNED);
    });

    it('un moderador no puede cambiar roles', async () => {
      mockActorAndTarget({ role: MembershipRole.MODERATOR });
      await expect(
        service.update(9, 3, 5, { role: MembershipRole.MODERATOR }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(membershipRepository.save).not.toHaveBeenCalled();
    });

    it('un moderador no gestiona a otro moderador', async () => {
      mockActorAndTarget(
        { role: MembershipRole.MODERATOR },
        { role: MembershipRole.MODERATOR },
      );
      await expect(
        service.update(9, 3, 5, { status: MembershipStatus.BANNED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('nadie modifica al propietario', async () => {
      mockActorAndTarget(
        { role: MembershipRole.MODERATOR },
        { role: MembershipRole.OWNER },
      );
      await expect(
        service.update(9, 3, 5, { status: MembershipStatus.BANNED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('no se puede aplicar la acción a uno mismo', async () => {
      mockActorAndTarget({});
      await expect(
        service.update(9, 3, 1, { status: MembershipStatus.BANNED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un miembro común no gestiona a nadie', async () => {
      mockActorAndTarget({ role: MembershipRole.MEMBER });
      await expect(
        service.update(9, 3, 5, { status: MembershipStatus.BANNED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('un actor vetado o pendiente no gestiona a nadie', async () => {
      membershipRepository.findOneBy.mockResolvedValue(null);
      await expect(
        service.update(9, 3, 5, { status: MembershipStatus.BANNED }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('kick', () => {
    it('expulsa a un miembro común', async () => {
      const { targetMembershipObj } = mockActorAndTarget({});
      await service.kick(9, 3, 5);
      expect(membershipRepository.remove).toHaveBeenCalledWith(
        targetMembershipObj,
      );
    });

    it('no expulsa a un vetado: levantaría el veto en silencio', async () => {
      mockActorAndTarget({}, { status: MembershipStatus.BANNED });
      await expect(service.kick(9, 3, 5)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(membershipRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('membresía por suscripción', () => {
    it('assertNotBanned lanza ForbiddenException si el perfil está vetado', async () => {
      membershipRepository.existsBy.mockResolvedValue(true);
      await expect(service.assertNotBanned(1, 3)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(membershipRepository.existsBy).toHaveBeenCalledWith({
        profileId: 1,
        communityId: 3,
        status: MembershipStatus.BANNED,
      });
    });

    describe('grantFromSubscription', () => {
      beforeEach(() => {
        membershipRepository.existsBy.mockResolvedValue(false);
      });

      it('crea una membresía ACTIVE de rol MEMBER si no existía', async () => {
        membershipRepository.findOneBy.mockResolvedValue(null);
        await service.grantFromSubscription(1, 3);
        expect(membershipRepository.save).toHaveBeenCalledWith({
          profileId: 1,
          communityId: 3,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        });
      });

      it('aprueba una solicitud PENDING conservando su rol', async () => {
        membershipRepository.findOneBy.mockResolvedValue(
          buildMembership({
            profileId: 1,
            status: MembershipStatus.PENDING,
          }),
        );
        await service.grantFromSubscription(1, 3);
        expect(membershipRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: MembershipStatus.ACTIVE,
            role: MembershipRole.MEMBER,
          }),
        );
      });

      it('no escribe nada si ya es miembro activo', async () => {
        membershipRepository.findOneBy.mockResolvedValue(
          buildMembership({ profileId: 1 }),
        );
        await service.grantFromSubscription(1, 3);
        expect(membershipRepository.save).not.toHaveBeenCalled();
      });

      it('un vetado no recupera acceso pagando', async () => {
        membershipRepository.existsBy.mockResolvedValue(true);
        await expect(
          service.grantFromSubscription(1, 3),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(membershipRepository.save).not.toHaveBeenCalled();
      });
    });

    it('revokeSubscriptionMembership solo borra miembros comunes activos o pendientes', async () => {
      await service.revokeSubscriptionMembership(1, 3);

      const criteria = membershipRepository.delete.mock.calls[0][0] as {
        profileId: number;
        communityId: number;
        role: MembershipRole;
        status: { _value: MembershipStatus[] };
      };
      // El propietario y los moderadores no dependen del pago; los vetados tampoco deben limpiarse
      expect(criteria.role).toBe(MembershipRole.MEMBER);
      expect(criteria.status._value).toEqual([
        MembershipStatus.ACTIVE,
        MembershipStatus.PENDING,
      ]);
      expect(criteria.profileId).toBe(1);
      expect(criteria.communityId).toBe(3);
    });
  });

  describe('findActiveMemberProfileIds', () => {
    it('devuelve solo los ids de perfil de los miembros activos', async () => {
      membershipRepository.find.mockResolvedValue([
        { profileId: 1 },
        { profileId: 5 },
      ]);

      await expect(service.findActiveMemberProfileIds(3)).resolves.toEqual([
        1, 5,
      ]);
      expect(membershipRepository.find).toHaveBeenCalledWith({
        where: { communityId: 3, status: MembershipStatus.ACTIVE },
        select: { profileId: true },
      });
    });
  });

  describe('assertActiveMember', () => {
    it('lanza ForbiddenException si no es miembro activo', async () => {
      membershipRepository.existsBy.mockResolvedValue(false);
      await expect(service.assertActiveMember(3, 1)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('no lanza si es miembro activo', async () => {
      membershipRepository.existsBy.mockResolvedValue(true);
      await expect(service.assertActiveMember(3, 1)).resolves.toBeUndefined();
      expect(membershipRepository.existsBy).toHaveBeenCalledWith({
        communityId: 3,
        profileId: 1,
        status: MembershipStatus.ACTIVE,
      });
    });
  });
});
