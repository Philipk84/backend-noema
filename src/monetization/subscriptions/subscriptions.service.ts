import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
} from '../../common/dto/pagination-query.dto';
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
import { Plan } from '../plans/entities/plan.entity';
import { PlansService } from '../plans/plans.service';
import {
  CreateSubscriptionDto,
  RenewSubscriptionDto,
} from './dto/create-subscription.dto';
import { Subscription } from './entities/subscription.entity';
import { PaymentGateway } from './gateway/payment-gateway';

/** Estados que conservan el acceso hasta endDate: una suscripción cancelada sigue vigente hasta entonces. */
const ENTITLED_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.CANCELLED,
];

/** Suma el periodo sin desbordar el mes: 31 de enero + 1 mes = 28/29 de febrero, no el 3 de marzo. */
export function addBillingPeriod(from: Date, period: BillingPeriod): Date {
  const months = period === BillingPeriod.YEARLY ? 12 : 1;
  const result = new Date(from);
  const dayOfMonth = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));
  return result;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly profilesService: ProfilesService,
    private readonly plansService: PlansService,
    private readonly membershipsService: MembershipsService,
    private readonly paymentGateway: PaymentGateway,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Suscribe al usuario a un plan y cobra el primer periodo. Si la pasarela
   * rechaza el cobro no se crea nada (responde 402). Si ya existía una
   * suscripción vencida o cancelada al plan, se reutiliza como una renovación.
   */
  async subscribe(
    userId: number,
    createSubscriptionDto: CreateSubscriptionDto,
  ): Promise<Subscription> {
    await this.expireOverdue();
    const profileObj = await this.profilesService.findByUserId(userId);
    const planObj = await this.plansService.findOne(
      createSubscriptionDto.planId,
    );

    if (!planObj.isActive) {
      throw new BadRequestException(
        'El plan ya no admite suscripciones nuevas',
      );
    }
    if (await this.plansService.isOwnedBy(planObj, profileObj.id)) {
      throw new BadRequestException('No puedes suscribirte a tu propio plan');
    }

    const existingSubscriptionObj = await this.subscriptionRepository.findOneBy(
      { profileId: profileObj.id, planId: planObj.id },
    );
    if (existingSubscriptionObj) {
      if (this.isEntitled(existingSubscriptionObj)) {
        throw new ConflictException(
          'Ya tienes una suscripción vigente a este plan; renuévala en lugar de crear otra',
        );
      }
      const renewedSubscriptionObj = await this.renew(
        userId,
        existingSubscriptionObj.id,
        createSubscriptionDto,
      );
      if (createSubscriptionDto.autoRenew !== undefined) {
        renewedSubscriptionObj.autoRenew = createSubscriptionDto.autoRenew;
        await this.subscriptionRepository.save(renewedSubscriptionObj);
      }
      return renewedSubscriptionObj;
    }

    if (planObj.communityId !== null) {
      await this.membershipsService.assertNotBanned(
        profileObj.id,
        planObj.communityId,
      );
    }

    const chargeResult = await this.paymentGateway.charge({
      amount: planObj.price,
      currency: planObj.currency,
      method: createSubscriptionDto.paymentMethod,
      token: createSubscriptionDto.paymentToken,
    });
    if (!chargeResult.approved) {
      throw new PaymentDeclinedException(
        chargeResult.reason ?? 'Pago rechazado',
      );
    }

    const startDate = new Date();
    const subscriptionObj = await this.dataSource.transaction(
      async (manager) => {
        const savedSubscriptionObj = await manager.save(
          manager.create(Subscription, {
            profileId: profileObj.id,
            planId: planObj.id,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate: addBillingPeriod(startDate, planObj.billingPeriod),
            autoRenew: createSubscriptionDto.autoRenew ?? false,
          }),
        );
        await manager.save(
          Payment,
          this.buildPaymentData(
            savedSubscriptionObj,
            planObj,
            createSubscriptionDto.paymentMethod,
            PaymentStatus.PAID,
            chargeResult.reference,
          ),
        );
        return savedSubscriptionObj;
      },
    );

    await this.grantCommunityAccess(planObj, profileObj.id);
    return await this.findOne(userId, subscriptionObj.id);
  }

  /**
   * Cobra otro periodo y extiende la vigencia desde la fecha de fin actual (o desde
   * hoy si ya venció). Si el cobro falla queda registrado un pago FAILED.
   */
  async renew(
    userId: number,
    id: number,
    renewSubscriptionDto: RenewSubscriptionDto,
  ): Promise<Subscription> {
    await this.expireOverdue();
    const subscriptionObj = await this.findOwned(userId, id);
    const planObj = subscriptionObj.plan;

    if (!planObj.isActive) {
      throw new BadRequestException(
        'El plan fue retirado y ya no se puede renovar',
      );
    }
    if (planObj.communityId !== null) {
      await this.membershipsService.assertNotBanned(
        subscriptionObj.profileId,
        planObj.communityId,
      );
    }

    const chargeResult = await this.paymentGateway.charge({
      amount: planObj.price,
      currency: planObj.currency,
      method: renewSubscriptionDto.paymentMethod,
      token: renewSubscriptionDto.paymentToken,
    });
    if (!chargeResult.approved) {
      // Un cobro fallido sobre una suscripción existente sí se deja registrado
      await this.dataSource.manager.save(
        Payment,
        this.buildPaymentData(
          subscriptionObj,
          planObj,
          renewSubscriptionDto.paymentMethod,
          PaymentStatus.FAILED,
          chargeResult.reference,
        ),
      );
      throw new PaymentDeclinedException(
        chargeResult.reason ?? 'Pago rechazado',
      );
    }

    const now = new Date();
    const periodStart = this.isEntitled(subscriptionObj)
      ? subscriptionObj.endDate
      : now;
    subscriptionObj.status = SubscriptionStatus.ACTIVE;
    subscriptionObj.endDate = addBillingPeriod(
      periodStart,
      planObj.billingPeriod,
    );
    if (subscriptionObj.endDate <= now) {
      subscriptionObj.startDate = now;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.save(subscriptionObj);
      await manager.save(
        Payment,
        this.buildPaymentData(
          subscriptionObj,
          planObj,
          renewSubscriptionDto.paymentMethod,
          PaymentStatus.PAID,
          chargeResult.reference,
        ),
      );
    });

    await this.grantCommunityAccess(planObj, subscriptionObj.profileId);
    return await this.findOwned(userId, id);
  }

  /** Cancela la renovación; el acceso continúa hasta endDate. */
  async cancel(userId: number, id: number): Promise<Subscription> {
    await this.expireOverdue();
    const subscriptionObj = await this.findOwned(userId, id);
    if (subscriptionObj.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Solo se puede cancelar una suscripción activa',
      );
    }
    subscriptionObj.status = SubscriptionStatus.CANCELLED;
    subscriptionObj.autoRenew = false;
    return await this.subscriptionRepository.save(subscriptionObj);
  }

  async findMine(
    userId: number,
    query: PaginationQueryDto,
  ): Promise<Paginated<Subscription>> {
    await this.expireOverdue();
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.subscriptionRepository.findAndCount({
      where: { profileId: profileObj.id },
      relations: { plan: true },
      order: { startDate: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(userId: number, id: number): Promise<Subscription> {
    await this.expireOverdue();
    return await this.findOwned(userId, id);
  }

  /** Indica si el perfil tiene una suscripción vigente a algún plan del autor. */
  async hasAccessToAuthor(
    profileId: number,
    authorId: number,
  ): Promise<boolean> {
    return await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .innerJoin('subscription.plan', 'plan')
      .where('subscription.profileId = :profileId', { profileId })
      .andWhere('plan.authorId = :authorId', { authorId })
      .andWhere('subscription.status IN (:...statuses)', {
        statuses: ENTITLED_STATUSES,
      })
      .andWhere('subscription.endDate > :now', { now: new Date() })
      .getExists();
  }

  /**
   * Marca como EXPIRED las suscripciones vencidas y retira las membresías de los
   * planes de comunidad. No hay un proceso periódico que lo ejecute, así que se
   * invoca al consultar suscripciones; un cron podría llamarlo directamente.
   */
  async expireOverdue(): Promise<number> {
    const overdueSubscriptionObjs = await this.subscriptionRepository.find({
      where: { status: In(ENTITLED_STATUSES), endDate: LessThan(new Date()) },
      relations: { plan: true },
    });
    if (overdueSubscriptionObjs.length === 0) {
      return 0;
    }

    await this.subscriptionRepository.update(
      {
        id: In(
          overdueSubscriptionObjs.map((subscriptionObj) => subscriptionObj.id),
        ),
      },
      { status: SubscriptionStatus.EXPIRED, autoRenew: false },
    );
    for (const subscriptionObj of overdueSubscriptionObjs) {
      if (subscriptionObj.plan.communityId !== null) {
        await this.membershipsService.revokeSubscriptionMembership(
          subscriptionObj.profileId,
          subscriptionObj.plan.communityId,
        );
      }
    }
    return overdueSubscriptionObjs.length;
  }

  private isEntitled(subscriptionObj: Subscription): boolean {
    return (
      ENTITLED_STATUSES.includes(subscriptionObj.status) &&
      subscriptionObj.endDate > new Date()
    );
  }

  private async grantCommunityAccess(
    planObj: Plan,
    profileId: number,
  ): Promise<void> {
    if (planObj.communityId !== null) {
      await this.membershipsService.grantFromSubscription(
        profileId,
        planObj.communityId,
      );
    }
  }

  private async findOwned(userId: number, id: number): Promise<Subscription> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const subscriptionObj = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { plan: true },
    });
    if (!subscriptionObj) {
      throw new SubscriptionNotFoundException(id);
    }
    if (subscriptionObj.profileId !== profileObj.id) {
      throw new ForbiddenException('Esta suscripción pertenece a otro perfil');
    }
    return subscriptionObj;
  }

  private buildPaymentData(
    subscriptionObj: Subscription,
    planObj: Plan,
    paymentMethod: PaymentMethod,
    status: PaymentStatus,
    externalReference: string,
  ): Partial<Payment> {
    return {
      subscriptionId: subscriptionObj.id,
      profileId: subscriptionObj.profileId,
      amount: planObj.price,
      currency: planObj.currency,
      paymentMethod,
      status,
      externalReference,
      paidAt: status === PaymentStatus.PAID ? new Date() : null,
    };
  }
}
