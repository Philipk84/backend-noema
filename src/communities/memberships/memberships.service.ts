import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Paginated } from '../../common/dto/pagination-query.dto';
import {
  MembershipApprovedEvent,
  MembershipRequestedEvent,
  NotificationEvents,
} from '../../notifications/events/notification.events';
import { ProfilesService } from '../../profiles/profiles.service';
import { CommunitiesService } from '../communities.service';
import { MembershipRole, MembershipStatus } from '../enums/membership.enums';
import {
  FindMembersQueryDto,
  UpdateMembershipDto,
} from './dto/update-membership.dto';
import { Membership } from './entities/membership.entity';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    private readonly profilesService: ProfilesService,
    private readonly communitiesService: CommunitiesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * El usuario se une a la comunidad. En una comunidad premium queda PENDING
   * hasta que un propietario o moderador la apruebe.
   */
  async join(userId: number, communityId: number): Promise<Membership> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const communityObj = await this.communitiesService.findEntity(communityId);

    const existingMembershipObj = await this.membershipRepository.findOneBy({
      profileId: profileObj.id,
      communityId,
    });
    if (existingMembershipObj) {
      if (existingMembershipObj.status === MembershipStatus.BANNED) {
        throw new ForbiddenException('Estás vetado de esta comunidad');
      }
      throw new ConflictException(
        existingMembershipObj.status === MembershipStatus.PENDING
          ? 'Tu solicitud ya está pendiente de aprobación'
          : 'Ya eres miembro de esta comunidad',
      );
    }

    const membershipObj = this.membershipRepository.create({
      profileId: profileObj.id,
      communityId,
      role: MembershipRole.MEMBER,
      status: communityObj.isPremium
        ? MembershipStatus.PENDING
        : MembershipStatus.ACTIVE,
    });
    const savedMembershipObj =
      await this.membershipRepository.save(membershipObj);

    if (savedMembershipObj.status === MembershipStatus.PENDING) {
      await this.eventEmitter.emitAsync(
        NotificationEvents.MEMBERSHIP_REQUESTED,
        {
          communityId,
          actorId: profileObj.id,
          ownerId: communityObj.ownerId,
        } satisfies MembershipRequestedEvent,
      );
    }
    return savedMembershipObj;
  }

  async leave(
    userId: number,
    communityId: number,
  ): Promise<{ message: string }> {
    const profileObj = await this.profilesService.findByUserId(userId);
    await this.communitiesService.findEntity(communityId);
    const membershipObj = await this.membershipRepository.findOneBy({
      profileId: profileObj.id,
      communityId,
    });
    if (!membershipObj) {
      throw new NotFoundException('No eres miembro de esta comunidad');
    }
    if (membershipObj.role === MembershipRole.OWNER) {
      throw new BadRequestException(
        'El propietario no puede abandonar su comunidad; elimínala en su lugar',
      );
    }
    if (membershipObj.status === MembershipStatus.BANNED) {
      // Salir borraría el registro del veto y permitiría volver a unirse
      throw new ForbiddenException('Estás vetado de esta comunidad');
    }

    await this.membershipRepository.remove(membershipObj);
    return { message: `Left community #${communityId}` };
  }

  /** Miembros activos son públicos; ver PENDING o BANNED exige ser propietario o moderador. */
  async findMembers(
    communityId: number,
    userId: number | null,
    query: FindMembersQueryDto,
  ): Promise<Paginated<Membership>> {
    await this.communitiesService.findEntity(communityId);
    const status = query.status ?? MembershipStatus.ACTIVE;
    if (status !== MembershipStatus.ACTIVE) {
      if (userId === null) {
        throw new ForbiddenException(
          'Solo propietarios y moderadores ven este listado',
        );
      }
      await this.getManagerMembership(userId, communityId);
    }

    const [data, total] = await this.membershipRepository.findAndCount({
      where: { communityId, status },
      relations: { profile: true },
      order: { joinedAt: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  /**
   * Aprueba, veta o reinstala miembros (propietario y moderadores) y cambia
   * roles (solo el propietario).
   */
  async update(
    userId: number,
    communityId: number,
    targetProfileId: number,
    updateMembershipDto: UpdateMembershipDto,
  ): Promise<Membership> {
    if (!updateMembershipDto.role && !updateMembershipDto.status) {
      throw new BadRequestException('Indica al menos role o status');
    }
    const { actorMembershipObj, targetMembershipObj } =
      await this.loadActorAndTarget(userId, communityId, targetProfileId);

    if (
      updateMembershipDto.role &&
      actorMembershipObj.role !== MembershipRole.OWNER
    ) {
      throw new ForbiddenException('Solo el propietario cambia roles');
    }

    const wasPending = targetMembershipObj.status === MembershipStatus.PENDING;
    if (updateMembershipDto.role) {
      targetMembershipObj.role = updateMembershipDto.role;
    }
    if (updateMembershipDto.status) {
      targetMembershipObj.status = updateMembershipDto.status;
    }
    const savedMembershipObj =
      await this.membershipRepository.save(targetMembershipObj);

    // Solo la aprobación de una solicitud avisa; los vetos y reinstalaciones no
    if (wasPending && savedMembershipObj.status === MembershipStatus.ACTIVE) {
      await this.eventEmitter.emitAsync(
        NotificationEvents.MEMBERSHIP_APPROVED,
        {
          communityId,
          actorId: actorMembershipObj.profileId,
          recipientId: targetProfileId,
        } satisfies MembershipApprovedEvent,
      );
    }
    return savedMembershipObj;
  }

  /** Expulsa a un miembro; a diferencia del veto, puede volver a unirse. */
  async kick(
    userId: number,
    communityId: number,
    targetProfileId: number,
  ): Promise<{ message: string }> {
    const { targetMembershipObj } = await this.loadActorAndTarget(
      userId,
      communityId,
      targetProfileId,
    );
    if (targetMembershipObj.status === MembershipStatus.BANNED) {
      // Borrar el registro levantaría el veto sin decirlo; para eso existe PATCH status ACTIVE
      throw new BadRequestException(
        'El miembro está vetado; levanta el veto con status ACTIVE en lugar de expulsarlo',
      );
    }
    await this.membershipRepository.remove(targetMembershipObj);
    return {
      message: `Profile #${targetProfileId} removed from the community`,
    };
  }

  /** Falla con 403 si el perfil está vetado; se llama antes de cobrar una suscripción. */
  async assertNotBanned(profileId: number, communityId: number): Promise<void> {
    const isBanned = await this.membershipRepository.existsBy({
      profileId,
      communityId,
      status: MembershipStatus.BANNED,
    });
    if (isBanned) {
      throw new ForbiddenException('Estás vetado de esta comunidad');
    }
  }

  /** Convierte al suscriptor de un plan de comunidad en miembro activo (aprueba una solicitud pendiente). */
  async grantFromSubscription(
    profileId: number,
    communityId: number,
  ): Promise<void> {
    await this.assertNotBanned(profileId, communityId);
    const membershipObj = await this.membershipRepository.findOneBy({
      profileId,
      communityId,
    });
    if (membershipObj?.status === MembershipStatus.ACTIVE) {
      return;
    }
    await this.membershipRepository.save(
      membershipObj
        ? { ...membershipObj, status: MembershipStatus.ACTIVE }
        : this.membershipRepository.create({
            profileId,
            communityId,
            role: MembershipRole.MEMBER,
            status: MembershipStatus.ACTIVE,
          }),
    );
  }

  /**
   * Quita la membresía cuando termina la suscripción. Respeta a moderadores,
   * al propietario y los vetos, que no dependen del pago.
   */
  async revokeSubscriptionMembership(
    profileId: number,
    communityId: number,
  ): Promise<void> {
    await this.membershipRepository.delete({
      profileId,
      communityId,
      role: MembershipRole.MEMBER,
      status: In([MembershipStatus.ACTIVE, MembershipStatus.PENDING]),
    });
  }

  async findActiveMemberProfileIds(communityId: number): Promise<number[]> {
    const membershipObjs = await this.membershipRepository.find({
      where: { communityId, status: MembershipStatus.ACTIVE },
      select: { profileId: true },
    });
    return membershipObjs.map((membershipObj) => membershipObj.profileId);
  }

  async isActiveMember(
    communityId: number,
    profileId: number,
  ): Promise<boolean> {
    return await this.membershipRepository.existsBy({
      communityId,
      profileId,
      status: MembershipStatus.ACTIVE,
    });
  }

  async assertActiveMember(
    communityId: number,
    profileId: number,
  ): Promise<void> {
    if (!(await this.isActiveMember(communityId, profileId))) {
      throw new ForbiddenException(
        'Debes ser miembro activo de la comunidad para hacerlo',
      );
    }
  }

  /** Membresía activa del usuario con rol OWNER o MODERATOR; si no, 403. */
  private async getManagerMembership(
    userId: number,
    communityId: number,
  ): Promise<Membership> {
    const profileObj = await this.profilesService.findByUserIdOrNull(userId);
    const membershipObj = profileObj
      ? await this.membershipRepository.findOneBy({
          profileId: profileObj.id,
          communityId,
          status: MembershipStatus.ACTIVE,
        })
      : null;
    if (!membershipObj || membershipObj.role === MembershipRole.MEMBER) {
      throw new ForbiddenException(
        'Solo propietarios y moderadores pueden hacerlo',
      );
    }
    return membershipObj;
  }

  /** Valida quién actúa y sobre quién: nadie toca al propietario ni a sí mismo, y un moderador solo a miembros. */
  private async loadActorAndTarget(
    userId: number,
    communityId: number,
    targetProfileId: number,
  ): Promise<{
    actorMembershipObj: Membership;
    targetMembershipObj: Membership;
  }> {
    await this.communitiesService.findEntity(communityId);
    const actorMembershipObj = await this.getManagerMembership(
      userId,
      communityId,
    );
    if (actorMembershipObj.profileId === targetProfileId) {
      throw new BadRequestException(
        'No puedes aplicarte esta acción a ti mismo',
      );
    }

    const targetMembershipObj = await this.membershipRepository.findOneBy({
      profileId: targetProfileId,
      communityId,
    });
    if (!targetMembershipObj) {
      throw new NotFoundException('El perfil no pertenece a esta comunidad');
    }
    if (targetMembershipObj.role === MembershipRole.OWNER) {
      throw new ForbiddenException('No se puede modificar al propietario');
    }
    if (
      actorMembershipObj.role === MembershipRole.MODERATOR &&
      targetMembershipObj.role !== MembershipRole.MEMBER
    ) {
      throw new ForbiddenException(
        'Un moderador solo gestiona a miembros comunes',
      );
    }
    return { actorMembershipObj, targetMembershipObj };
  }
}
