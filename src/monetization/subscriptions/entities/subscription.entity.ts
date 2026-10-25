import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Profile } from '../../../profiles/entities/profile.entity';
import { SubscriptionStatus } from '../../enums/monetization.enums';
import { Plan } from '../../plans/entities/plan.entity';

// Un perfil tiene una sola suscripción por plan; volver a suscribirse la reutiliza
@Entity('subscriptions')
@Unique(['profileId', 'planId'])
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'profile_id' })
  profileId: number;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate: Date;

  // Hasta esta fecha hay acceso, incluso si la suscripción se canceló
  @Column({ name: 'end_date', type: 'timestamptz' })
  endDate: Date;

  // Solo es una marca: no hay un proceso automático que renueve (ver SubscriptionsService.expireOverdue)
  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;
}
