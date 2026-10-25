import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Paginated } from '../../common/dto/pagination-query.dto';
import { PaymentNotFoundException } from '../../common/exceptions/http/payment-not-found.exception';
import { MembershipsService } from '../../communities/memberships/memberships.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { PaymentStatus, SubscriptionStatus } from '../enums/monetization.enums';
import { FindPaymentsQueryDto } from './dto/find-payments-query.dto';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly profilesService: ProfilesService,
    private readonly membershipsService: MembershipsService,
    private readonly dataSource: DataSource,
  ) {}

  async findMine(
    userId: number,
    query: FindPaymentsQueryDto,
  ): Promise<Paginated<Payment>> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const [data, total] = await this.paymentRepository.findAndCount({
      where: {
        profileId: profileObj.id,
        ...(query.subscriptionId !== undefined && {
          subscriptionId: query.subscriptionId,
        }),
      },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return { data, total, page: query.page, limit: query.limit };
  }

  async findOne(userId: number, id: number): Promise<Payment> {
    const profileObj = await this.profilesService.findByUserId(userId);
    const paymentObj = await this.paymentRepository.findOneBy({ id });
    if (!paymentObj) {
      throw new PaymentNotFoundException(id);
    }
    if (paymentObj.profileId !== profileObj.id) {
      throw new ForbiddenException('Este pago pertenece a otro perfil');
    }
    return paymentObj;
  }

  /**
   * Reembolsa un pago cobrado (solo administración). La suscripción termina en
   * el acto y, si era de una comunidad, el suscriptor deja de ser miembro.
   */
  async refund(id: number): Promise<Payment> {
    const paymentObj = await this.paymentRepository.findOne({
      where: { id },
      relations: { subscription: { plan: true } },
    });
    if (!paymentObj) {
      throw new PaymentNotFoundException(id);
    }
    if (paymentObj.status !== PaymentStatus.PAID) {
      throw new ConflictException(
        `Solo se reembolsan pagos PAID; este pago está ${paymentObj.status}`,
      );
    }

    const subscriptionObj = paymentObj.subscription;
    await this.dataSource.transaction(async (manager) => {
      paymentObj.status = PaymentStatus.REFUNDED;
      await manager.save(Payment, paymentObj);

      subscriptionObj.status = SubscriptionStatus.EXPIRED;
      subscriptionObj.endDate = new Date();
      subscriptionObj.autoRenew = false;
      await manager.save(subscriptionObj);
    });

    if (subscriptionObj.plan.communityId !== null) {
      await this.membershipsService.revokeSubscriptionMembership(
        subscriptionObj.profileId,
        subscriptionObj.plan.communityId,
      );
    }
    return paymentObj;
  }
}
