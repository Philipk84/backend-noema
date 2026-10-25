import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
import { PlanNotFoundException } from '../../common/exceptions/http/plan-not-found.exception';
import { CommunitiesService } from '../../communities/communities.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import {
  CreatePlanDto,
  FindPlansQueryDto,
  UpdatePlanDto,
} from './dto/create-plan.dto';
import { Plan } from './entities/plan.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly profilesService: ProfilesService,
    private readonly communitiesService: CommunitiesService,
  ) {}

  /** Crea un plan del autor o, si se indica communityId, de una comunidad que el usuario posee. */
  async create(userId: number, createPlanDto: CreatePlanDto): Promise<Plan> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const { communityId, ...planData } = createPlanDto;

    if (communityId !== undefined) {
      const communityObj =
        await this.communitiesService.findEntity(communityId);
      if (communityObj.ownerId !== profileObj.id) {
        throw new ForbiddenException(
          'Solo el propietario puede crear planes de la comunidad',
        );
      }
    }

    const planObj = this.planRepository.create({
      ...planData,
      authorId: communityId === undefined ? profileObj.id : null,
      communityId: communityId ?? null,
    });
    return await this.planRepository.save(planObj);
  }

  /** Catálogo público: solo planes activos. */
  async findAll(query: FindPlansQueryDto): Promise<Paginated<Plan>> {
    const [data, total] = await this.planRepository.findAndCount({
      where: {
        isActive: true,
        ...(query.authorId !== undefined && { authorId: query.authorId }),
        ...(query.communityId !== undefined && {
          communityId: query.communityId,
        }),
      },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  /** Planes que el usuario administra, activos o no: los suyos y los de las comunidades que posee. */
  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Plan>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.planRepository
      .createQueryBuilder('plan')
      .leftJoin('plan.community', 'community')
      .where('plan.authorId = :profileId OR community.ownerId = :profileId', {
        profileId: profileObj.id,
      })
      .orderBy('plan.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(id: number): Promise<Plan> {
    const planObj = await this.planRepository.findOneBy({ id });
    if (!planObj) {
      throw new PlanNotFoundException(id);
    }
    return planObj;
  }

  async update(
    userId: number,
    id: number,
    updatePlanDto: UpdatePlanDto,
  ): Promise<Plan> {
    const planObj = await this.findOwned(userId, id);
    this.planRepository.merge(planObj, updatePlanDto);
    return await this.planRepository.save(planObj);
  }

  async remove(userId: number, id: number): Promise<{ message: string }> {
    const planObj = await this.findOwned(userId, id);
    const subscriptionCount = await this.subscriptionRepository.countBy({
      planId: planObj.id,
    });
    if (subscriptionCount > 0) {
      throw new ConflictException(
        `El plan tiene ${subscriptionCount} suscripción(es); desactívalo con isActive en lugar de borrarlo`,
      );
    }
    await this.planRepository.remove(planObj);
    return { message: `Plan with id #${id} deleted successfully` };
  }

  /** Indica si el perfil administra el plan: es el autor o el propietario de la comunidad. */
  async isOwnedBy(planObj: Plan, profileId: number): Promise<boolean> {
    if (planObj.authorId !== null) {
      return planObj.authorId === profileId;
    }
    const communityObj = await this.communitiesService.findEntity(
      planObj.communityId!,
    );
    return communityObj.ownerId === profileId;
  }

  private async findOwned(userId: number, id: number): Promise<Plan> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const planObj = await this.findOne(id);
    if (!(await this.isOwnedBy(planObj, profileObj.id))) {
      throw new ForbiddenException('Este plan pertenece a otro perfil');
    }
    return planObj;
  }
}
